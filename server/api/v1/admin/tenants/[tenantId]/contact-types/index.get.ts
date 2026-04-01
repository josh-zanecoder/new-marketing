import { getTenantClientModels } from '../../../../../../models/tenant/tenantClientModels'
import { isAdminAuthContext } from '../../../../../../tenant/registry-auth'
import { getTenantConnectionByTenantId } from '../../../../../../tenant/connection'

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

  const tenantConn = await getTenantConnectionByTenantId(tenantId)
  if (!tenantConn) {
    throw createError({ statusCode: 404, message: 'Tenant not found' })
  }

  const { ContactType: Model } = getTenantClientModels(tenantConn)
  const docs = await Model.find({})
    .sort({ sortOrder: 1, key: 1 })
    .lean()
    .exec()

  return {
    contactTypes: docs.map((d) => ({
      id: String((d as { _id: unknown })._id),
      key: String((d as { key?: unknown }).key ?? ''),
      label: String((d as { label?: unknown }).label ?? ''),
      enabled: (d as { enabled?: boolean }).enabled !== false,
      sortOrder: Number((d as { sortOrder?: number }).sortOrder ?? 0)
    }))
  }
})
