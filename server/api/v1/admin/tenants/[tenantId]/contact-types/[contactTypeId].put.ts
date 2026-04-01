import mongoose from 'mongoose'
import type { ContactTypeDoc } from '../../../../../../models/tenant/ContactType'
import { getTenantClientModels } from '../../../../../../models/tenant/tenantClientModels'
import { isAdminAuthContext } from '../../../../../../tenant/registry-auth'
import { getTenantConnectionByTenantId } from '../../../../../../tenant/connection'

function normalizeKey(input: unknown): string {
  return String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as unknown
  if (!isAdminAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const rawTid = getRouterParam(event, 'tenantId') ?? ''
  const tenantId = decodeURIComponent(rawTid).trim()
  const contactTypeId = getRouterParam(event, 'contactTypeId') ?? ''
  if (!tenantId || !contactTypeId || !mongoose.Types.ObjectId.isValid(contactTypeId)) {
    throw createError({ statusCode: 400, message: 'Invalid request' })
  }

  const body = await readBody<{
    key?: unknown
    label?: unknown
    enabled?: boolean
    sortOrder?: number
  }>(event)

  const patch: Record<string, unknown> = {}
  if (body?.key !== undefined) {
    const key = normalizeKey(body.key)
    if (!key) throw createError({ statusCode: 400, message: 'key cannot be empty' })
    patch.key = key
  }
  if (body?.label !== undefined) {
    const label = String(body.label ?? '').trim()
    if (!label) {
      throw createError({ statusCode: 400, message: 'label cannot be empty' })
    }
    patch.label = label
  }
  if (typeof body?.enabled === 'boolean') patch.enabled = body.enabled
  if (body?.sortOrder !== undefined) {
    patch.sortOrder = Number.isFinite(body.sortOrder) ? Number(body.sortOrder) : 0
  }
  if (!Object.keys(patch).length) {
    throw createError({ statusCode: 400, message: 'No fields to update' })
  }

  const tenantConn = await getTenantConnectionByTenantId(tenantId)
  if (!tenantConn) {
    throw createError({ statusCode: 404, message: 'Tenant not found' })
  }

  const { ContactType: Model } = getTenantClientModels(tenantConn)
  try {
    const doc = await Model.findOneAndUpdate(
      { _id: contactTypeId },
      { $set: patch },
      { new: true, runValidators: true }
    ).exec()
    if (!doc) {
      throw createError({ statusCode: 404, message: 'Contact type not found' })
    }

    const saved = doc.toObject() as unknown as ContactTypeDoc & {
      _id: mongoose.Types.ObjectId
    }
    return {
      contactType: {
        id: String(saved._id),
        key: saved.key,
        label: saved.label,
        enabled: saved.enabled,
        sortOrder: saved.sortOrder
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
        message: 'A contact type with this key already exists for this tenant'
      })
    }
    throw e
  }
})
