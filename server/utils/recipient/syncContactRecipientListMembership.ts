import type { Connection } from 'mongoose'
import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { ContactLean } from '@server/types/tenant/contact.model'
import type { RecipientListCriterion } from '@server/types/tenant/recipientList.model'
import { mergeContactOwnerScopeFilter } from '@server/utils/contactOwnerFilter'
import { canonicalRecipientFilterFieldsFromDoc } from '@server/utils/recipient/recipientFilterValidation'
import { recipientFilterContactTypeMatch } from '@server/utils/recipient/recipientListAudience'
import { buildContactFilterQuery } from '@server/utils/recipient/recipientListMembershipQuery'
import { normalizeRecipientListDoc, registryDocToCriteria } from '@server/utils/recipient/recipientListNormalization'
import {
  pickJoinsForQuery,
  recipientListOwnerEmailForContactScope,
  recipientListStoredMembershipEmails
} from '@server/utils/recipient/recipientListMutation'

type RecipientListDoc = Record<string, unknown> & { _id: mongoose.Types.ObjectId }

type RecipientListSyncConfig = {
  listId: mongoose.Types.ObjectId
  scopedQuery: Record<string, unknown>
}

async function buildRecipientListScopedQueryForSync(
  tenantConn: Connection,
  listDoc: RecipientListDoc
): Promise<Record<string, unknown>> {
  const normalized = normalizeRecipientListDoc(listDoc)
  const { audience, filters, filterMode } = normalized
  const criterionGroups = await criterionGroupsFromFilterRows(
    tenantConn,
    audience,
    listDoc.filterRows
  )
  const nonEmptyGroups = criterionGroups.filter((g) => g.length > 0)
  const groupsForQuery = nonEmptyGroups.length > 0 ? criterionGroups : undefined
  const joinsForQuery = pickJoinsForQuery(
    criterionGroups,
    null,
    listDoc as { criterionJoins?: unknown }
  )
  const baseQuery = buildContactFilterQuery(
    audience,
    filters,
    filterMode,
    groupsForQuery,
    joinsForQuery
  )
  const scopeRaw = (listDoc as { membershipScope?: unknown }).membershipScope
  const membershipScope =
    scopeRaw === 'tenant' || scopeRaw === 'owner_emails' ? scopeRaw : 'owner_emails'
  const storedEmails = recipientListStoredMembershipEmails(
    listDoc as { membershipOwnerEmails?: unknown }
  )
  const listOE = recipientListOwnerEmailForContactScope(
    listDoc as { metadata?: { ownerEmail?: unknown } | null }
  )
  const ownerScopeForSync =
    storedEmails.length > 0 ? storedEmails : listOE ? [listOE] : undefined
  return membershipScope === 'tenant'
    ? (baseQuery as Record<string, unknown>)
    : mergeContactOwnerScopeFilter(baseQuery as Record<string, unknown>, ownerScopeForSync)
}

async function loadDynamicRecipientListSyncConfigs(
  tenantConn: Connection
): Promise<RecipientListSyncConfig[]> {
  const { RecipientList } = getTenantClientModels(tenantConn)
  const lists = await RecipientList.find({ listType: { $nin: ['static'] } })
    .lean<RecipientListDoc[]>()
  const configs: RecipientListSyncConfig[] = []
  for (const listDoc of lists) {
    configs.push({
      listId: listDoc._id,
      scopedQuery: await buildRecipientListScopedQueryForSync(tenantConn, listDoc)
    })
  }
  return configs
}

/**
 * Rebuilds criterion groups from persisted `filterRows` (same semantics as list create/patch).
 * When rows are missing or filters are gone, falls back to flat `filters` only via `buildContactFilterQuery`.
 */
async function criterionGroupsFromFilterRows(
  tenantConn: Connection,
  audience: string,
  rawRows: unknown
): Promise<RecipientListCriterion[][]> {
  if (!Array.isArray(rawRows) || !rawRows.length) return []
  const { RecipientFilter: FilterModel } = getTenantClientModels(tenantConn)
  const criterionGroups: RecipientListCriterion[][] = []
  for (const row of rawRows) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const recipientFilterId =
      typeof r.recipientFilterId === 'string' && r.recipientFilterId.trim()
        ? r.recipientFilterId.trim()
        : ''
    if (!recipientFilterId || !mongoose.isValidObjectId(recipientFilterId)) continue
    const listPropertyValue =
      typeof r.listPropertyValue === 'string' ? r.listPropertyValue.trim().slice(0, 2000) : ''

    const doc = await FilterModel.findOne({
      _id: new mongoose.Types.ObjectId(recipientFilterId),
      enabled: true,
      ...recipientFilterContactTypeMatch(audience)
    })
      .lean()
      .exec()

    if (!doc) continue
    const filterDoc = doc as Record<string, unknown>
    const { property } = canonicalRecipientFilterFieldsFromDoc(filterDoc)
    const registryVal = typeof filterDoc.propertyValue === 'string' ? filterDoc.propertyValue.trim() : ''
    const effectiveValue = listPropertyValue || registryVal
    if (property !== 'none' && !effectiveValue) continue

    const rowCriteria = registryDocToCriteria({
      ...filterDoc,
      propertyValue: effectiveValue
    } as Parameters<typeof registryDocToCriteria>[0])
    if (rowCriteria.length) criterionGroups.push(rowCriteria)
  }
  return criterionGroups
}

/**
 * After a contact is created or updated, add or remove `RecipientListMember` rows for every
 * non-static list so membership matches list rules (same query family as full rebuild).
 * Workers: `membershipScope === 'tenant'` → criteria only; `owner_emails` →
 * `membershipOwnerEmails` snapshot, else fallback `metadata.ownerEmail`.
 */
export async function syncContactRecipientListMembership(
  tenantConn: Connection,
  contactId: mongoose.Types.ObjectId
): Promise<void> {
  const { Contact, RecipientList, RecipientListMember } = getTenantClientModels(tenantConn)

  const contact = await Contact.findById(contactId)
    .select('_id deletedAt isUnsubscribe')
    .lean<Pick<ContactLean, '_id' | 'deletedAt' | 'isUnsubscribe'>>()
  if (!contact || contact.deletedAt || contact.isUnsubscribe === true) {
    await RecipientListMember.deleteMany({ contactId })
    return
  }

  const listConfigs = await loadDynamicRecipientListSyncConfigs(tenantConn)
  for (const { listId, scopedQuery } of listConfigs) {
    const match = await Contact.findOne({
      $and: [{ _id: contactId }, scopedQuery]
    })
      .select('_id')
      .lean()
    if (match) {
      await RecipientListMember.updateOne(
        { recipientListId: listId, contactId },
        { $setOnInsert: { recipientListId: listId, contactId } },
        { upsert: true }
      )
    } else {
      await RecipientListMember.deleteOne({ recipientListId: listId, contactId })
    }
  }
}

/** Launch-sync path: one list query per dynamic list instead of per contact. */
export async function syncContactRecipientListMembershipBatch(
  tenantConn: Connection,
  contactIds: mongoose.Types.ObjectId[],
  heartbeat?: () => Promise<void>
): Promise<void> {
  if (!contactIds.length) return
  const { Contact, RecipientListMember } = getTenantClientModels(tenantConn)
  const listConfigs = await loadDynamicRecipientListSyncConfigs(tenantConn)
  await heartbeat?.()
  for (const { listId, scopedQuery } of listConfigs) {
    const matching = await Contact.find({
      $and: [{ _id: { $in: contactIds } }, scopedQuery]
    })
      .select('_id')
      .lean()
    const matchingIds = new Set(matching.map((doc) => String(doc._id)))
    const memberUpserts: {
      updateOne: {
        filter: { recipientListId: mongoose.Types.ObjectId; contactId: mongoose.Types.ObjectId }
        update: { $setOnInsert: { recipientListId: mongoose.Types.ObjectId; contactId: mongoose.Types.ObjectId } }
        upsert: true
      }
    }[] = []
    const removeContactIds: mongoose.Types.ObjectId[] = []
    for (const contactId of contactIds) {
      if (matchingIds.has(String(contactId))) {
        memberUpserts.push({
          updateOne: {
            filter: { recipientListId: listId, contactId },
            update: { $setOnInsert: { recipientListId: listId, contactId } },
            upsert: true
          }
        })
      } else {
        removeContactIds.push(contactId)
      }
    }
    if (memberUpserts.length) {
      await RecipientListMember.bulkWrite(memberUpserts, { ordered: false })
    }
    if (removeContactIds.length) {
      await RecipientListMember.deleteMany({
        recipientListId: listId,
        contactId: { $in: removeContactIds }
      })
    }
    await heartbeat?.()
  }
}
