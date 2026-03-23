import mongoose from 'mongoose'
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

  const rawTid = getRouterParam(event, 'tenantId') ?? ''
  const tenantId = decodeURIComponent(rawTid).trim()
  const filterId = getRouterParam(event, 'filterId') ?? ''
  if (!tenantId || !filterId || !mongoose.Types.ObjectId.isValid(filterId)) {
    throw createError({ statusCode: 400, message: 'Invalid request' })
  }

  const body = await readBody<{
    name?: string
    contactType?: unknown
    property?: unknown
    propertyType?: unknown
    propertyValue?: unknown
    enabled?: boolean
  }>(event)

  const patch: Record<string, unknown> = {}
  if (typeof body?.name === 'string') {
    const n = body.name.trim()
    if (!n) {
      throw createError({ statusCode: 400, message: 'name cannot be empty' })
    }
    patch.name = n
  }
  if (body?.contactType !== undefined) {
    patch.contactType = normalizeRecipientFilterContactType(body.contactType)
  }
  if (body?.propertyValue !== undefined) {
    patch.propertyValue = normalizeRecipientFilterPropertyValue(body.propertyValue)
  }
  if (typeof body?.enabled === 'boolean') patch.enabled = body.enabled

  const registryConn = await getRegistryConnection()
  const Model = getRecipientFilterModel(registryConn)

  if (body?.property !== undefined || body?.propertyType !== undefined) {
    const existing = await Model.findOne({ _id: filterId, tenantId }).lean().exec()
    if (!existing) {
      throw createError({ statusCode: 404, message: 'Filter not found' })
    }
    const ex = existing as {
      property?: string
      propertyType?: string | null
    }
    const rawProp =
      body.property !== undefined ? body.property : ex.property ?? 'none'
    const rawType =
      body.propertyType !== undefined
        ? body.propertyType
        : ex.propertyType ?? 'none'
    const { property, propertyType } = normalizeRecipientFilterPropertyFields(
      rawProp,
      rawType
    )
    patch.property = property
    patch.propertyType = propertyType
  }

  if (!Object.keys(patch).length) {
    throw createError({ statusCode: 400, message: 'No fields to update' })
  }

  try {
    const doc = await Model.findOneAndUpdate(
      { _id: filterId, tenantId },
      { $set: patch },
      { new: true, runValidators: true }
    ).exec()

    if (!doc) {
      throw createError({ statusCode: 404, message: 'Filter not found' })
    }

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
