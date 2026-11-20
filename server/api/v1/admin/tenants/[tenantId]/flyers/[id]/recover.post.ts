import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { FlyerModel } from '@server/types/tenant/flyer.model'
import { isAdminAuthContext } from '@server/tenant/registry-auth'
import { getTenantConnectionByTenantId } from '@server/tenant/connection'
import { recoverSoftDeletedFlyer } from '@server/utils/flyer/recoverFlyer'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as unknown
  if (!isAdminAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const rawTid = getRouterParam(event, 'tenantId') ?? ''
  const tenantId = decodeURIComponent(rawTid).trim()
  const id = getRouterParam(event, 'id') ?? ''
  if (!tenantId || !id || !mongoose.Types.ObjectId.isValid(id)) {
    throw createError({ statusCode: 400, message: 'Invalid request' })
  }

  const tenantConn = await getTenantConnectionByTenantId(tenantId)
  if (!tenantConn) {
    throw createError({ statusCode: 404, message: 'Tenant not found' })
  }

  const { Flyer } = getTenantClientModels(tenantConn)
  const result = await recoverSoftDeletedFlyer(Flyer as FlyerModel, id)

  if (!result.ok) {
    throw createError({ statusCode: 404, message: 'Flyer not found' })
  }

  return { ok: true, alreadyActive: result.alreadyActive }
})
