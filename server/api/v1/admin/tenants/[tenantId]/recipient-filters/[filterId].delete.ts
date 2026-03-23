import mongoose from 'mongoose'
import { getRegistryConnection } from '../../../../../../lib/mongoose'
import { getRecipientFilterModel } from '../../../../../../models/registry/RecipientFilter'
import { isAdminAuthContext } from '../../../../../../tenant/registry-auth'

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

  const registryConn = await getRegistryConnection()
  const Model = getRecipientFilterModel(registryConn)
  const res = await Model.deleteOne({
    _id: filterId,
    tenantId
  }).exec()

  if (res.deletedCount === 0) {
    throw createError({ statusCode: 404, message: 'Filter not found' })
  }

  return { ok: true }
})
