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
  const contactTypeId = getRouterParam(event, 'contactTypeId') ?? ''
  if (!tenantId || !contactTypeId || !mongoose.Types.ObjectId.isValid(contactTypeId)) {
    throw createError({ statusCode: 400, message: 'Invalid request' })
  }

  const tenantConn = await getTenantConnectionByTenantId(tenantId)
  if (!tenantConn) {
    throw createError({ statusCode: 404, message: 'Tenant not found' })
  }

  const { ContactType: Model, RecipientFilter: RecipientFilterModel } =
    getTenantClientModels(tenantConn)
  const doc = await Model.findOne({ _id: contactTypeId }).lean().exec()
  if (!doc) {
    throw createError({ statusCode: 404, message: 'Contact type not found' })
  }

  const key = String((doc as { key?: unknown }).key ?? '').trim().toLowerCase()
  const inUse = await RecipientFilterModel.exists({ contactType: key })
  if (inUse) {
    throw createError({
      statusCode: 409,
      message: 'This contact type is currently used by recipient filters'
    })
  }

  await Model.deleteOne({ _id: contactTypeId }).exec()
  return { ok: true }
})
