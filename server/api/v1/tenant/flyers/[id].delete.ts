import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { FlyerModel } from '@server/types/tenant/flyer.model'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { requireMarketingFlyersPermission } from '@server/utils/flyer/requireMarketingFlyersPermission'
import { softDeleteFlyerById } from '@server/utils/flyer/softDeleteFlyer'
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

  const result = await softDeleteFlyerById(flyerModel, rawId)
  if (!result.matched) {
    throw createError({ statusCode: 404, message: 'Flyer not found' })
  }

  return { ok: true, alreadyDeleted: result.alreadyDeleted }
})
