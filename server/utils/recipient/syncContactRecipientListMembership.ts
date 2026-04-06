import type { Connection } from 'mongoose'
import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { ContactKind, ContactLean } from '@server/types/tenant/contact.model'
import type { RecipientListCriterion } from '@server/types/tenant/recipientList.model'
import { mergeContactOwnerScopeFilter } from '@server/utils/contactOwnerFilter'
import { canonicalRecipientFilterFieldsFromDoc } from '@server/utils/recipient/recipientFilterValidation'
import { buildContactFilterQuery } from '@server/utils/recipient/recipientListContactQuery'
import { normalizeRecipientListDoc, registryDocToCriteria } from '@server/utils/recipient/recipientListDocument'
import { pickJoinsForQuery } from '@server/utils/recipient/recipientListMutation'

type RecipientListDoc = Record<string, unknown> & { _id: mongoose.Types.ObjectId }

/**
 * Rebuilds criterion groups from persisted `filterRows` (same semantics as list create/patch).
 * When rows are missing or filters are gone, falls back to flat `filters` only via `buildContactFilterQuery`.
 */
async function criterionGroupsFromFilterRows(
  tenantConn: Connection,
  audience: ContactKind,
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
      contactType: audience
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
 * Kafka / workers have no API-key owner scope — all tenant contacts are evaluated.
 */
export async function syncContactRecipientListMembership(
  tenantConn: Connection,
  contactId: mongoose.Types.ObjectId
): Promise<void> {
  const { Contact, RecipientList, RecipientListMember } = getTenantClientModels(tenantConn)

  const contact = await Contact.findById(contactId)
    .select('_id deletedAt')
    .lean<Pick<ContactLean, '_id' | 'deletedAt'>>()
  if (!contact || contact.deletedAt) {
    await RecipientListMember.deleteMany({ contactId })
    return
  }

  const lists = await RecipientList.find({ listType: { $nin: ['static'] } })
    .lean<RecipientListDoc[]>()

  for (const listDoc of lists) {
    const listId = listDoc._id
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
    const scopedQuery = mergeContactOwnerScopeFilter(
      baseQuery as Record<string, unknown>,
      undefined
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
}
