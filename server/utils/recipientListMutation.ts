import mongoose from 'mongoose'
import type { Connection } from 'mongoose'
import { getRecipientFilterModel } from '../models/registry/RecipientFilter'
import { getTenantClientModels } from '../models/tenant/tenantClientModels'
import type { ContactKind } from '../types/tenant/contact.model'
import type {
  RecipientListCriterion,
  RecipientListFilterMode
} from '../types/tenant/recipientList.model'
import { isTenantApiKeyAuthContext } from '../tenant/registry-auth'
import { mergeContactOwnerScopeFilter } from './contactOwnerFilter'
import { canonicalRecipientFilterFieldsFromDoc } from './recipientFilterValidation'
import { buildContactFilterQuery } from './recipientListContactQuery'
import { registryDocToCriteria } from './recipientListDocument'

const MEMBER_INSERT_BATCH = 1000

export async function resolveRecipientListFiltersFromBody(
  body: Record<string, unknown>,
  registryConn: Connection,
  tenantId: string | null,
  audience: ContactKind
): Promise<{
  filters: RecipientListCriterion[]
  criterionGroups: RecipientListCriterion[][]
  persistedFilterRows: { recipientFilterId: string; listPropertyValue: string }[]
}> {
  let filters: RecipientListCriterion[] = []
  const criterionGroups: RecipientListCriterion[][] = []
  const persistedFilterRows: { recipientFilterId: string; listPropertyValue: string }[] =
    []

  const rawRows = body?.filterRows
  const useFilterRows = Array.isArray(rawRows) && rawRows.length > 0

  if (useFilterRows) {
    if (!tenantId) {
      throw createError({
        statusCode: 400,
        message:
          'This account has no tenant ID in the registry; recipient filters cannot be applied'
      })
    }
    const FilterModel = getRecipientFilterModel(registryConn)
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
        tenantId,
        enabled: true,
        contactType: audience
      })
        .lean()
        .exec()

      if (!doc) {
        throw createError({
          statusCode: 404,
          message:
            'Recipient filter not found, disabled, or does not match the selected audience'
        })
      }

      const { property } = canonicalRecipientFilterFieldsFromDoc(doc)
      const registryVal =
        typeof doc.propertyValue === 'string' ? doc.propertyValue.trim() : ''
      const effectiveValue = listPropertyValue || registryVal

      if (property !== 'none' && !effectiveValue) {
        throw createError({
          statusCode: 400,
          message:
            'This filter has no saved value; enter a value for the property before creating the list'
        })
      }

      const rowCriteria = registryDocToCriteria({
        ...doc,
        propertyValue: effectiveValue
      })
      if (rowCriteria.length) {
        criterionGroups.push(rowCriteria)
        filters.push(...rowCriteria)
      }
      persistedFilterRows.push({
        recipientFilterId,
        listPropertyValue
      })
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
      if (!tenantId) {
        throw createError({
          statusCode: 400,
          message:
            'This account has no tenant ID in the registry; recipient filters cannot be applied'
        })
      }
      if (!mongoose.isValidObjectId(recipientFilterId)) {
        throw createError({ statusCode: 400, message: 'Invalid recipient filter id' })
      }
      const FilterModel = getRecipientFilterModel(registryConn)
      const doc = await FilterModel.findOne({
        _id: new mongoose.Types.ObjectId(recipientFilterId),
        tenantId,
        enabled: true,
        contactType: audience
      })
        .lean()
        .exec()

      if (!doc) {
        throw createError({
          statusCode: 404,
          message:
            'Recipient filter not found, disabled, or does not match the selected audience'
        })
      }

      const { property } = canonicalRecipientFilterFieldsFromDoc(doc)
      const registryVal =
        typeof doc.propertyValue === 'string' ? doc.propertyValue.trim() : ''
      const effectiveValue = listPropertyValue || registryVal

      if (property !== 'none' && !effectiveValue) {
        throw createError({
          statusCode: 400,
          message:
            'This filter has no saved value; enter a value for the property before creating the list'
        })
      }

      const legacyCriteria = registryDocToCriteria({
        ...doc,
        propertyValue: effectiveValue
      })
      filters = legacyCriteria
      if (legacyCriteria.length) {
        criterionGroups.push(legacyCriteria)
      }
      persistedFilterRows.push({
        recipientFilterId,
        listPropertyValue
      })
    }
  }

  return { filters, criterionGroups, persistedFilterRows }
}

export async function rebuildRecipientListMembers(
  tenantConn: Connection,
  listId: mongoose.Types.ObjectId,
  audience: ContactKind,
  filters: RecipientListCriterion[],
  filterMode: RecipientListFilterMode,
  criterionGroups: RecipientListCriterion[][],
  auth: unknown
): Promise<number> {
  const { Contact, RecipientListMember } = getTenantClientModels(tenantConn)

  await RecipientListMember.deleteMany({ recipientListId: listId })

  const groupsForAndMode =
    filterMode === 'and' && criterionGroups.length > 0 ? criterionGroups : undefined

  const contactQuery = buildContactFilterQuery(
    audience,
    filters,
    filterMode,
    groupsForAndMode
  )
  const ownerScope =
    isTenantApiKeyAuthContext(auth) && auth.contactOwnerScope?.length
      ? auth.contactOwnerScope
      : undefined
  const scopedContactQuery = mergeContactOwnerScopeFilter(
    contactQuery as Record<string, unknown>,
    ownerScope
  )

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
