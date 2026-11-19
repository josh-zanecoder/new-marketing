import { assertAdminAuth } from '@server/utils/admin/adminCampaigns'
import { ackMarketingSyncDlqEntry } from '@server/utils/marketingSyncHealth/store'

export default defineEventHandler(async (event) => {
  assertAdminAuth(event)

  const id = decodeURIComponent(String(getRouterParam(event, 'id') || '')).trim()
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'DLQ id is required' })
  }

  const ok = await ackMarketingSyncDlqEntry(id)
  if (!ok) {
    throw createError({ statusCode: 404, statusMessage: 'DLQ entry not found' })
  }

  return { ok: true, id, action: 'ack' as const }
})
