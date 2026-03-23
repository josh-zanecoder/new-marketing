import mongoose from 'mongoose'
import { getRegistryConnection } from '../../../../lib/mongoose'
import { getRecipientFilterModel } from '../../../../models/registry/RecipientFilter'
import { getTenantClientModels } from '../../../../models/tenant/tenantClientModels'
import type { ContactKind } from '../../../../types/tenant/contact.model'
import type {
  RecipientListCriterion,
  RecipientListFilterMode
} from '../../../../types/tenant/recipientList.model'
import {
  isRegisteredTenantAuthContext,
  resolveTenantIdForTenantAuth
} from '../../../../tenant/registry-auth'
import { getTenantConnectionFromEvent } from '../../../../tenant/connection'
import { canonicalRecipientFilterFieldsFromDoc } from '../../../../utils/recipientFilterValidation'
import { buildContactFilterQuery } from '../../../../utils/recipientListContactQuery'
import { registryDocToCriteria } from '../../../../utils/recipientListDocument'

const MEMBER_INSERT_BATCH = 1000
type CreatedRecipientList = {
  name?: string
  listType?: string
  audience?: string
  filters?: unknown[]
  filterMode?: string
  createdAt?: Date | null
  updatedAt?: Date | null
}

const AUDIENCES = new Set<ContactKind>(['prospect', 'client', 'contact'])

function assertAudience(raw: unknown): ContactKind {
  if (typeof raw === 'string' && AUDIENCES.has(raw as ContactKind)) {
    return raw as ContactKind
  }
  throw createError({
    statusCode: 400,
    message: 'Invalid audience (use prospect, client, or contact)'
  })
}

function assertFilterMode(raw: unknown): RecipientListFilterMode {
  if (raw === 'or') return 'or'
  if (raw === 'and' || raw === undefined) return 'and'
  throw createError({
    statusCode: 400,
    message: 'Invalid filterMode (use and or or)'
  })
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as unknown
  if (!isRegisteredTenantAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Tenant access required' })
  }

  const body = await readBody(event).catch(() => ({}))
  const name =
    typeof body?.name === 'string' ? body.name.trim().slice(0, 200) : ''
  if (!name) {
    throw createError({ statusCode: 400, message: 'Name is required' })
  }

  const audience = assertAudience(body?.audience)
  const filterMode = assertFilterMode(body?.filterMode)

  const registryConn = await getRegistryConnection()
  const tenantId = await resolveTenantIdForTenantAuth(registryConn, auth)

  let filters: RecipientListCriterion[] = []
  /** One entry per UI filter row — used in AND mode so rows are AND’d (same field twice → no matches). */
  const criterionGroups: RecipientListCriterion[][] = []

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
    }
  }

  const tenantConn = await getTenantConnectionFromEvent(event)
  const { RecipientList, Contact, RecipientListMember } =
    getTenantClientModels(tenantConn)

  const created = await RecipientList.create({
    name,
    description: '',
    listType: 'dynamic',
    audience,
    filters,
    filterMode,
    clientId: ''
  })

  const listId = created._id
  const groupsForAndMode =
    filterMode === 'and' && criterionGroups.length > 0 ? criterionGroups : undefined

  const contactQuery = buildContactFilterQuery(
    audience,
    filters,
    filterMode,
    groupsForAndMode
  )
  let memberCount = 0

  const cursor = Contact.find(contactQuery).select('_id').lean().cursor()
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

  const lean = created.toObject() as CreatedRecipientList

  return {
    list: {
      id: String(created._id),
      name: lean.name ?? '',
      listType: lean.listType ?? '',
      audience: lean.audience ?? '',
      filters: lean.filters ?? [],
      filterMode: lean.filterMode === 'or' ? 'or' : 'and',
      memberCount,
      createdAt: lean.createdAt?.toISOString?.() ?? null,
      updatedAt: lean.updatedAt?.toISOString?.() ?? null
    }
  }
})
