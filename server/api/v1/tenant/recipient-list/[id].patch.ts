import mongoose from 'mongoose'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { updateRecipientList } from '@server/utils/recipient/recipientListService'

export default defineEventHandler(async (event) => {
  const rawId = getRouterParam(event, 'id')
  if (!rawId || !mongoose.isValidObjectId(rawId)) {
    throw createError({ statusCode: 400, message: 'Invalid list id' })
  }

  const body = (await readBody(event).catch(() => ({}))) as Record<string, unknown>
  const tenantConn = await getTenantConnectionFromEvent(event)

  return updateRecipientList({
    tenantConn,
    auth: event.context.auth as unknown,
    listId: new mongoose.Types.ObjectId(rawId),
    body
  })
})
