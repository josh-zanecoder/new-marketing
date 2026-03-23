import { getRegistryConnection } from '../../../../../../lib/mongoose'
import { getRecipientFilterModel } from '../../../../../../models/registry/RecipientFilter'
import { isAdminAuthContext } from '../../../../../../tenant/registry-auth'
import {
  canonicalRecipientFilterFieldsFromDoc,
  normalizeRecipientFilterContactType,
  normalizeRecipientFilterPropertyFields,
  normalizeRecipientFilterPropertyValue
} from '../../../../../../utils/recipientFilterValidation'

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

  const contactType = normalizeRecipientFilterContactType(body?.contactType)
  const { property, propertyType } = normalizeRecipientFilterPropertyFields(
    body?.property,
    body?.propertyType
  )
  const propertyValue = normalizeRecipientFilterPropertyValue(body?.propertyValue)
  const enabled = body?.enabled !== false

  const registryConn = await getRegistryConnection()
  const Model = getRecipientFilterModel(registryConn)
  try {
    const doc = await Model.create({
      tenantId,
      name,
      contactType,
      property,
      propertyType,
      propertyValue,
      enabled
    })
    const canon = canonicalRecipientFilterFieldsFromDoc(doc.toObject())
    return {
      filter: {
        id: String(doc._id),
        tenantId: doc.tenantId,
        name: doc.name,
        contactType: doc.contactType,
        property: canon.property,
        propertyType: canon.propertyType,
        propertyValue: doc.propertyValue,
        enabled: doc.enabled
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
