import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { createRecipientList } from '@server/utils/recipient/recipientListService'

export default defineEventHandler(async (event) => {
  const body = (await readBody(event).catch(() => ({}))) as Record<string, unknown>
  const tenantConn = await getTenantConnectionFromEvent(event)
  return createRecipientList({
    tenantConn,
    auth: event.context.auth as unknown,
    body
  })
})
