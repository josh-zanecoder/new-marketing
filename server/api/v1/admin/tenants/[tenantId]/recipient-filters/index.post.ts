import type { RecipientFilterDoc } from '@server/models/tenant/RecipientFilter'
import type { Types } from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { isAdminAuthContext } from '@server/tenant/registry-auth'
import { getTenantConnectionByTenantId } from '@server/tenant/connection'
import {
  canonicalRecipientFilterFieldsFromDoc,
  normalizeRecipientFilterPropertyFields,
  normalizeRecipientFilterPropertyValue
} from '@server/utils/recipient/recipientFilterValidation'

function normalizeContactType(input: unknown): string {
  return String(input ?? '').trim().toLowerCase()
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as unknown
  if (!isAdminAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const raw = getRouterParam(event, 'tenantId') ?? ''
  const tenantId = decodeURIComponent(raw).trim()
  if (!tenantId) {
    throw createError({ statusCode: 400, message: 'Missing tenant id' })
  }

  const body = await readBody<{
    name?: string
    contactType?: unknown
    property?: unknown
    propertyType?: unknown
    propertyValue?: unknown
    enabled?: boolean
  }>(event)

  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name) {
    throw createError({ statusCode: 400, message: 'name is required' })
  }

  const contactType = normalizeContactType(body?.contactType)
  if (!contactType) {
    throw createError({ statusCode: 400, message: 'contactType is required' })
  }
  const { property, propertyType } = normalizeRecipientFilterPropertyFields(
    body?.property,
    body?.propertyType
  )
  const propertyValue = normalizeRecipientFilterPropertyValue(body?.propertyValue)
  const enabled = body?.enabled !== false

  const tenantConn = await getTenantConnectionByTenantId(tenantId)
  if (!tenantConn) {
    throw createError({ statusCode: 404, message: 'Tenant not found' })
  }

  const { RecipientFilter: Model, ContactType: ContactTypeModel } =
    getTenantClientModels(tenantConn)
  const existingType = await ContactTypeModel.findOne({
    key: contactType,
    enabled: true
  })
    .select({ _id: 1 })
    .lean()
    .exec()
  if (!existingType) {
    throw createError({
      statusCode: 400,
      message: 'Invalid contactType for this tenant'
    })
  }
  try {
    const doc = await Model.create({
      name,
      contactType,
      property,
      propertyType,
      propertyValue,
      enabled
    })
    const saved = doc.toObject() as unknown as RecipientFilterDoc & {
      _id: Types.ObjectId
    }
    const canon = canonicalRecipientFilterFieldsFromDoc(saved)
    return {
      filter: {
        id: String(saved._id),
        tenantId,
        name: saved.name,
        contactType: saved.contactType,
        property: canon.property,
        propertyType: canon.propertyType,
        propertyValue: saved.propertyValue,
        enabled: saved.enabled
      }
    }
  } catch (e: unknown) {
    if (
      e &&
      typeof e === 'object' &&
      'code' in e &&
      (e as { code?: number }).code === 11000
    ) {
      throw createError({
        statusCode: 409,
        message: 'A filter with this name already exists for this tenant'
      })
    }
    throw e
  }
})
