import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { isAdminAuthContext } from '@server/tenant/registry-auth'
import { getTenantConnectionByTenantId } from '@server/tenant/connection'

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

  const tenantConn = await getTenantConnectionByTenantId(tenantId)
  if (!tenantConn) {
    throw createError({ statusCode: 404, message: 'Tenant not found' })
  }

  const { RecipientFilter: Model } = getTenantClientModels(tenantConn)
  const res = await Model.deleteOne({
    _id: filterId
  }).exec()

  if (res.deletedCount === 0) {
    throw createError({ statusCode: 404, message: 'Filter not found' })
  }

  return { ok: true }
})
