import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { deleteCustomMarketingTenantImages } from '@server/services/customMarketingImageUpload.service'
import type { FlyerModel } from '@server/types/tenant/flyer.model'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { resolveCustomMarketingTenantFolderName } from '@server/utils/customMarketing/resolveCustomMarketingTenantFolderName'
import { requireMarketingFlyersPermission } from '@server/utils/flyer/requireMarketingFlyersPermission'
import { hostedImageViewerFromAuth } from '@server/utils/hostedImage/hostedImageAccessFromAuth'
import { MARKETING_FLYERS_DELETE_PERMISSION } from '~~/shared/constants/marketingFlyersPermissions'

export default defineEventHandler(async (event) => {
  requireMarketingFlyersPermission(event, MARKETING_FLYERS_DELETE_PERMISSION)

  const rawId = getRouterParam(event, 'id')
  if (!rawId || !mongoose.isValidObjectId(rawId)) {
    throw createError({ statusCode: 400, message: 'Invalid flyer id' })
  }

  const conn = await getTenantConnectionFromEvent(event)
  const { Flyer } = getTenantClientModels(conn)
  const flyerModel = Flyer as FlyerModel

  const existing = await flyerModel.findById(rawId).lean()
  if (!existing) {
    throw createError({ statusCode: 404, message: 'Flyer not found' })
  }

  const auth = event.context.auth
  const objectPath = typeof existing.objectPath === 'string' ? existing.objectPath.trim() : ''
  if (objectPath) {
    try {
      const tenantName = await resolveCustomMarketingTenantFolderName(auth)
      const viewer = hostedImageViewerFromAuth(auth)
      await deleteCustomMarketingTenantImages(tenantName, [objectPath], viewer)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[flyers.delete] GCS object delete failed', { objectPath, error: message })
    }
  }

  await flyerModel.deleteOne({ _id: existing._id })

  return { ok: true }
})
