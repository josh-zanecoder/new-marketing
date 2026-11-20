import mongoose from 'mongoose'
import { getRegistryConnection } from '@server/lib/mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { FlyerModel } from '@server/types/tenant/flyer.model'
import {
  findRegistryTenantByTenantId,
  isAdminAuthContext
} from '@server/tenant/registry-auth'
import { getTenantConnectionByTenantId } from '@server/tenant/connection'
import { hardDeleteSoftDeletedFlyer } from '@server/utils/flyer/hardDeleteFlyer'

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

  const registry = await getRegistryConnection()
  const row = await findRegistryTenantByTenantId(registry, tenantId)
  const tenantFolderName = row?.tenantName?.trim() || ''

  const { Flyer } = getTenantClientModels(tenantConn)
  const result = await hardDeleteSoftDeletedFlyer({
    Flyer: Flyer as FlyerModel,
    flyerId: id,
    tenantFolderName
  })

  if (!result.ok) {
    if (result.reason === 'not_found') {
      throw createError({ statusCode: 404, message: 'Flyer not found' })
    }
    throw createError({
      statusCode: 400,
      message: 'Only soft-deleted flyers can be permanently deleted'
    })
  }

  return { ok: true, gcsDeleted: result.gcsDeleted }
})
