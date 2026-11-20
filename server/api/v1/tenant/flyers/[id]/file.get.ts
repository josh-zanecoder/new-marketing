import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { downloadCustomMarketingObjectBuffer } from '@server/services/customMarketingImageUpload.service'
import type { FlyerModel } from '@server/types/tenant/flyer.model'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { requireMarketingFlyersPermission } from '@server/utils/flyer/requireMarketingFlyersPermission'
import { MARKETING_FLYERS_READ_PERMISSION } from '~~/shared/constants/marketingFlyersPermissions'
import { ACTIVE_FLYER_FILTER } from '~~/shared/utils/flyerActive'

/** Stream a flyer binary (same-origin) so the client can render PDF page thumbnails. */
export default defineEventHandler(async (event) => {
  requireMarketingFlyersPermission(event, MARKETING_FLYERS_READ_PERMISSION)

  const rawId = getRouterParam(event, 'id')
  if (!rawId || !mongoose.isValidObjectId(rawId)) {
    throw createError({ statusCode: 400, message: 'Invalid flyer id' })
  }

  const conn = await getTenantConnectionFromEvent(event)
  const { Flyer } = getTenantClientModels(conn)
  const flyerModel = Flyer as FlyerModel
  const existing = await flyerModel.findOne({ _id: rawId, ...ACTIVE_FLYER_FILTER }).lean()
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
