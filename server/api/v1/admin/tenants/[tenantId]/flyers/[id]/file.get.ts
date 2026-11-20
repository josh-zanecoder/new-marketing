import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { downloadCustomMarketingObjectBuffer } from '@server/services/customMarketingImageUpload.service'
import type { FlyerModel } from '@server/types/tenant/flyer.model'
import { isAdminAuthContext } from '@server/tenant/registry-auth'
import { getTenantConnectionByTenantId } from '@server/tenant/connection'

/** Stream a flyer binary for admin trash preview (includes soft-deleted docs). */
export default defineEventHandler(async (event) => {
  const auth = event.context.auth as unknown
  if (!isAdminAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const rawTid = getRouterParam(event, 'tenantId') ?? ''
  const tenantId = decodeURIComponent(rawTid).trim()
  const rawId = getRouterParam(event, 'id') ?? ''
  if (!tenantId || !rawId || !mongoose.isValidObjectId(rawId)) {
    throw createError({ statusCode: 400, message: 'Invalid request' })
  }

  const tenantConn = await getTenantConnectionByTenantId(tenantId)
  if (!tenantConn) {
    throw createError({ statusCode: 404, message: 'Tenant not found' })
  }

  const { Flyer } = getTenantClientModels(tenantConn)
  const flyerModel = Flyer as FlyerModel
  const existing = await flyerModel.findById(rawId).lean()
  if (!existing) {
    throw createError({ statusCode: 404, message: 'Flyer not found' })
  }

  const objectPath = typeof existing.objectPath === 'string' ? existing.objectPath.trim() : ''
  if (!objectPath) {
    throw createError({ statusCode: 404, message: 'Flyer file is missing' })
  }

  const downloaded = await downloadCustomMarketingObjectBuffer(objectPath)
  const contentType =
    typeof existing.contentType === 'string' && existing.contentType.trim()
      ? existing.contentType.trim()
      : downloaded.contentType
  const fileName =
    typeof existing.fileName === 'string' && existing.fileName.trim()
      ? existing.fileName.trim()
      : 'flyer'

  setHeader(event, 'Content-Type', contentType)
  setHeader(event, 'Content-Disposition', `inline; filename="${fileName.replace(/"/g, '')}"`)
  setHeader(event, 'Cache-Control', 'private, max-age=300')
  return downloaded.buffer
})
