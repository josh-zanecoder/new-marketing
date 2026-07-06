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
type FilterDoc = Record<string, unknown>

function recipientFilterDocMatchesAudience(filterDoc: FilterDoc, audience: string): boolean {
  const ct = filterDoc.contactType
  if (typeof ct !== 'string' || !ct.trim()) return false
  const { contactType } = recipientFilterContactTypeMatch(audience)
  return contactType.test(ct.trim())
}

function collectRecipientFilterIds(lists: RecipientListDoc[]): mongoose.Types.ObjectId[] {
  const ids = new Set<string>()
  for (const listDoc of lists) {
    const rows = listDoc.filterRows
    if (!Array.isArray(rows)) continue
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue
      const recipientFilterId =
        typeof (row as Record<string, unknown>).recipientFilterId === 'string'
          ? String((row as Record<string, unknown>).recipientFilterId).trim()
          : ''
      if (recipientFilterId && mongoose.isValidObjectId(recipientFilterId)) {
        ids.add(recipientFilterId)
      }
    }
  }
  return [...ids].map((id) => new mongoose.Types.ObjectId(id))
}

async function loadRecipientFiltersById(
  tenantConn: Connection,
  lists: RecipientListDoc[]
): Promise<Map<string, FilterDoc>> {
  const objectIds = collectRecipientFilterIds(lists)
  if (!objectIds.length) return new Map()

  const { RecipientFilter: FilterModel } = getTenantClientModels(tenantConn)
  const docs = await FilterModel.find({
    _id: { $in: objectIds },
    enabled: true
  })
    .lean()
    .exec()

  const map = new Map<string, FilterDoc>()
  for (const doc of docs) {
    map.set(String((doc as { _id: unknown })._id), doc as FilterDoc)
  }
  return map
}

/**
 * Rebuilds criterion groups from persisted `filterRows` (same semantics as list create/patch).
 * When rows are missing or filters are gone, falls back to flat `filters` only via `buildContactFilterQuery`.
 */
function criterionGroupsFromFilterRows(
  audience: string,
  rawRows: unknown,
  filterById: Map<string, FilterDoc>
): RecipientListCriterion[][] {
  if (!Array.isArray(rawRows) || !rawRows.length) return []
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

    const filterDoc = filterById.get(recipientFilterId)
    if (!filterDoc || !recipientFilterDocMatchesAudience(filterDoc, audience)) continue

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

async function syncContactToList(
  models: ReturnType<typeof getTenantClientModels>,
  contactId: mongoose.Types.ObjectId,
  listDoc: RecipientListDoc,
  filterById: Map<string, FilterDoc>
): Promise<void> {
  const { Contact, RecipientListMember } = models
  const listId = listDoc._id
  const normalized = normalizeRecipientListDoc(listDoc)
  const { audience, filters, filterMode } = normalized

  const criterionGroups = criterionGroupsFromFilterRows(audience, listDoc.filterRows, filterById)
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
  const scopedQuery =
    membershipScope === 'tenant'
      ? baseQuery
      : mergeContactOwnerScopeFilter(
          baseQuery as Record<string, unknown>,
          ownerScopeForSync
        )

  const match = await Contact.findOne({
    $and: [{ _id: contactId }, scopedQuery as Record<string, unknown>]
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
  const models = getTenantClientModels(tenantConn)
  const { Contact, RecipientList, RecipientListMember } = models

  const contact = await Contact.findById(contactId)
    .select('_id deletedAt')
    .lean<Pick<ContactLean, '_id' | 'deletedAt'>>()
  if (!contact || contact.deletedAt) {
    await RecipientListMember.deleteMany({ contactId })
    return
  }

  const lists = await RecipientList.find({ listType: { $nin: ['static'] } })
    .lean<RecipientListDoc[]>()
  if (!lists.length) return

  const filterById = await loadRecipientFiltersById(tenantConn, lists)
  await Promise.all(
    lists.map((listDoc) => syncContactToList(models, contactId, listDoc, filterById))
  )
}

/** Runs list-membership sync without blocking the HTTP response. */
export function scheduleContactRecipientListMembershipSync(
  tenantConn: Connection,
  contactId: mongoose.Types.ObjectId
): void {
  void syncContactRecipientListMembership(tenantConn, contactId).catch((err) => {
    console.error('[RecipientListMembership] sync failed', {
      contactId: String(contactId),
      err
    })
  })
}
