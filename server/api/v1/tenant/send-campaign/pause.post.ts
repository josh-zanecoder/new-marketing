import { haltCampaignSend } from '@server/services/campaign-send-control.service'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ campaignId: string }>(event)
  const campaignId = String(body?.campaignId ?? '').trim()
  if (!campaignId) throw createError({ statusCode: 400, message: 'campaignId is required' })

  const conn = await getTenantConnectionFromEvent(event)
  console.log('[SendCampaignAPI] pause', { campaignId, dbName: conn.db?.databaseName })

  return haltCampaignSend(conn, campaignId, { mode: 'pause', auth: event.context.auth })
})
