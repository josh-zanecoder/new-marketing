import mongoose from 'mongoose'
import type { Connection } from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { ContactKind } from '@server/types/tenant/contact.model'
import type {
  RecipientListCriterion,
  RecipientListCriterionJoin,
  RecipientListFilterMode,
  RecipientListMembershipScope
} from '@server/types/tenant/recipientList.model'
import {
  mergeContactOwnerScopeFilter,
  mergeTenantOwnerEmailScopeFilter
} from '@server/utils/contactOwnerFilter'
import { canonicalRecipientFilterFieldsFromDoc } from '@server/utils/recipient/recipientFilterValidation'
import { buildContactFilterQuery } from '@server/utils/recipient/recipientListContactQuery'
import { registryDocToCriteria } from '@server/utils/recipient/recipientListDocument'

const MEMBER_INSERT_BATCH = 1000

function defaultCriterionJoins(groupCount: number): RecipientListCriterionJoin[] {
  const need = Math.max(0, groupCount - 1)
  return Array.from({ length: need }, () => 'and' as const)
}

/**
 * Parse `criterionJoins` from API body. Returns `null` when the field is omitted (PATCH: keep existing).
 */
export function parseCriterionJoinsFromBody(
  raw: unknown,
  groupCount: number
): RecipientListCriterionJoin[] | null {
  if (raw === undefined) return null
  const need = Math.max(0, groupCount - 1)
  if (need === 0) {
    if (raw === null) return []
    if (Array.isArray(raw) && raw.length === 0) return []
    throw createError({
      statusCode: 400,
      message: 'criterionJoins must be an empty array when there is only one filter row'
    })
  }
  if (!Array.isArray(raw)) {
    throw createError({ statusCode: 400, message: 'criterionJoins must be an array' })
  }
  if (raw.length !== need) {
    throw createError({
      statusCode: 400,
      message: `criterionJoins must have length ${need} (one of "and" | "or" between each pair of filter rows)`
    })
  }
  return raw.map((x, i) => {
    if (x === 'or') return 'or'
    if (x === 'and' || x === undefined) return 'and'
    throw createError({
      statusCode: 400,
      message: `criterionJoins[${i}] must be "and" or "or"`
    })
  })
}

export function pickJoinsForQuery(
  groups: RecipientListCriterion[][],
  fromBody: RecipientListCriterionJoin[] | null,
  existing: { criterionJoins?: unknown } | null | undefined
): RecipientListCriterionJoin[] | null {
  const nonEmpty = groups.filter((g) => g.length > 0)
  const need = Math.max(0, nonEmpty.length - 1)
  if (fromBody !== null) {
    if (fromBody.length === need) return fromBody
    return null
  }
  const ex = existing?.criterionJoins
  if (Array.isArray(ex) && ex.length === need) {
    return ex.map((x) => (x === 'or' ? 'or' : ('and' as const)))
  }
  return null
}

export async function resolveRecipientListFiltersFromBody(
  body: Record<string, unknown>,
  tenantConn: Connection,
  audience: ContactKind
): Promise<{
  filters: RecipientListCriterion[]
  criterionGroups: RecipientListCriterion[][]
  persistedFilterRows: { recipientFilterId: string; listPropertyValue: string }[]
  criterionJoinsFromBody: RecipientListCriterionJoin[] | null
}> {
  let filters: RecipientListCriterion[] = []
  const criterionGroups: RecipientListCriterion[][] = []
  const persistedFilterRows: { recipientFilterId: string; listPropertyValue: string }[] = []

  const rawRows = body?.filterRows
  const useFilterRows = Array.isArray(rawRows) && rawRows.length > 0

  if (useFilterRows) {
    const { RecipientFilter: FilterModel } = getTenantClientModels(tenantConn)
    for (const row of rawRows as unknown[]) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const recipientFilterId =
        typeof r.recipientFilterId === 'string' && r.recipientFilterId.trim()
          ? r.recipientFilterId.trim()
          : ''
      if (!recipientFilterId) continue

      if (!mongoose.isValidObjectId(recipientFilterId)) {
        throw createError({ statusCode: 400, message: 'Invalid recipient filter id' })
      }
      const listPropertyValue =
        typeof r.listPropertyValue === 'string'
          ? r.listPropertyValue.trim().slice(0, 2000)
          : ''

      const doc = await FilterModel.findOne({
        _id: new mongoose.Types.ObjectId(recipientFilterId),
        enabled: true,
        contactType: audience
      }).lean().exec()

      if (!doc) {
        throw createError({
          statusCode: 404,
          message: 'Recipient filter not found, disabled, or does not match the selected audience'
        })
      }

      const filterDoc = doc as Record<string, unknown>
      const { property } = canonicalRecipientFilterFieldsFromDoc(filterDoc)
      const registryVal = typeof filterDoc.propertyValue === 'string' ? filterDoc.propertyValue.trim() : ''
      const effectiveValue = listPropertyValue || registryVal

      if (property !== 'none' && !effectiveValue) {
        throw createError({
          statusCode: 400,
          message: 'This filter has no saved value; enter a value for the property before creating the list'
        })
      }

      const rowCriteria = registryDocToCriteria({
        ...filterDoc,
        propertyValue: effectiveValue
      })
      if (rowCriteria.length) {
        criterionGroups.push(rowCriteria)
        filters.push(...rowCriteria)
      }
      persistedFilterRows.push({ recipientFilterId, listPropertyValue })
    }
  } else {
    const rawFilterId = body?.recipientFilterId
    const recipientFilterId =
      typeof rawFilterId === 'string' && rawFilterId.trim()
        ? rawFilterId.trim()
        : null

    const listPropertyValueRaw =
      typeof body?.listPropertyValue === 'string' ? body.listPropertyValue : ''
    const listPropertyValue = listPropertyValueRaw.trim().slice(0, 2000)

    if (recipientFilterId) {
      if (!mongoose.isValidObjectId(recipientFilterId)) {
        throw createError({ statusCode: 400, message: 'Invalid recipient filter id' })
      }
      const { RecipientFilter: FilterModel } = getTenantClientModels(tenantConn)
      const doc = await FilterModel.findOne({
        _id: new mongoose.Types.ObjectId(recipientFilterId),
        enabled: true,
        contactType: audience
      }).lean().exec()

      if (!doc) {
        throw createError({
          statusCode: 404,
          message: 'Recipient filter not found, disabled, or does not match the selected audience'
        })
      }

      const filterDoc = doc as Record<string, unknown>
      const { property } = canonicalRecipientFilterFieldsFromDoc(filterDoc)
      const registryVal = typeof filterDoc.propertyValue === 'string' ? filterDoc.propertyValue.trim() : ''
      const effectiveValue = listPropertyValue || registryVal

      if (property !== 'none' && !effectiveValue) {
        throw createError({
          statusCode: 400,
          message: 'This filter has no saved value; enter a value for the property before creating the list'
        })
      }

      const legacyCriteria = registryDocToCriteria({
        ...filterDoc,
        propertyValue: effectiveValue
      })
      filters = legacyCriteria
      if (legacyCriteria.length) criterionGroups.push(legacyCriteria)
      persistedFilterRows.push({ recipientFilterId, listPropertyValue })
    }
  }

  const criterionJoinsFromBody = parseCriterionJoinsFromBody(
    body?.criterionJoins,
    criterionGroups.length
  )

  return { filters, criterionGroups, persistedFilterRows, criterionJoinsFromBody }
}

/** Normalized `membershipOwnerEmails` from a list document. */
export function recipientListStoredMembershipEmails(doc: {
  membershipOwnerEmails?: unknown
}): string[] {
  const raw = doc.membershipOwnerEmails
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const x of raw) {
    if (typeof x !== 'string') continue
    const t = x.trim().toLowerCase()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

/** Lowercased `metadata.ownerEmail` when set (fallback for sync when `membershipOwnerEmails` empty). */
export function recipientListOwnerEmailForContactScope(doc: {
  metadata?: { ownerEmail?: unknown } | null
}): string | undefined {
  const m = doc.metadata
  if (!m || typeof m !== 'object') return undefined
  const e = (m as { ownerEmail?: unknown }).ownerEmail
  if (typeof e !== 'string') return undefined
  const t = e.trim().toLowerCase()
  return t || undefined
}

export async function rebuildRecipientListMembers(
  tenantConn: Connection,
  listId: mongoose.Types.ObjectId,
  audience: ContactKind,
  filters: RecipientListCriterion[],
  filterMode: RecipientListFilterMode,
  criterionGroups: RecipientListCriterion[][],
  auth: unknown,
  membershipScope: RecipientListMembershipScope,
  membershipOwnerEmails: string[],
  storedCriterionJoins?: RecipientListCriterionJoin[] | null
): Promise<number> {
  const { Contact, RecipientListMember } = getTenantClientModels(tenantConn)
  await RecipientListMember.deleteMany({ recipientListId: listId })

  const nonEmptyGroups = criterionGroups.filter((g) => g.length > 0)
  const groupsForQuery = nonEmptyGroups.length > 0 ? criterionGroups : undefined

  const contactQuery = buildContactFilterQuery(
    audience,
    filters,
    filterMode,
    groupsForQuery,
    storedCriterionJoins ?? null
  )
  const scopedContactQuery =
    membershipScope === 'tenant'
      ? (contactQuery as Record<string, unknown>)
      : membershipOwnerEmails.length > 0
        ? mergeContactOwnerScopeFilter(
            contactQuery as Record<string, unknown>,
            membershipOwnerEmails
          )
        : mergeTenantOwnerEmailScopeFilter(contactQuery as Record<string, unknown>, auth)

  let memberCount = 0
  const cursor = Contact.find(scopedContactQuery).select('_id').lean().cursor()
  let batch: { recipientListId: typeof listId; contactId: unknown }[] = []

  for await (const doc of cursor) {
    batch.push({ recipientListId: listId, contactId: doc._id })
    if (batch.length >= MEMBER_INSERT_BATCH) {
      await RecipientListMember.insertMany(batch, { ordered: false })
      memberCount += batch.length
      batch = []
    }
  }
  if (batch.length) {
    await RecipientListMember.insertMany(batch, { ordered: false })
    memberCount += batch.length
  }

  return memberCount
}
