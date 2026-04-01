import type { Types } from 'mongoose'
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

  const raw = getRouterParam(event, 'tenantId') ?? ''
  const tenantId = decodeURIComponent(raw).trim()
  if (!tenantId) {
    throw createError({ statusCode: 400, message: 'Missing tenant id' })
  }

  const body = await readBody<{
    key?: unknown
    label?: unknown
    enabled?: boolean
    sortOrder?: number
  }>(event)

  const key = normalizeKey(body?.key)
  const label = String(body?.label ?? '').trim()
  if (!key || !label) {
    throw createError({ statusCode: 400, message: 'key and label are required' })
  }

  const tenantConn = await getTenantConnectionByTenantId(tenantId)
  if (!tenantConn) {
    throw createError({ statusCode: 404, message: 'Tenant not found' })
  }

  const { ContactType: Model } = getTenantClientModels(tenantConn)
  try {
    const doc = await Model.create({
      key,
      label,
      enabled: body?.enabled !== false,
      sortOrder: Number.isFinite(body?.sortOrder) ? Number(body?.sortOrder) : 0
    })
    const saved = doc.toObject() as unknown as ContactTypeDoc & {
      _id: Types.ObjectId
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
