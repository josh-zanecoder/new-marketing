import { restartCampaignSend } from '@server/services/campaign-send-control.service'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { tenantUserFieldsFromAuth } from '@server/utils/emailMerge/tenantUserFromAuth'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ campaignId: string }>(event)
  const campaignId = String(body?.campaignId ?? '').trim()
  if (!campaignId) throw createError({ statusCode: 400, message: 'campaignId is required' })

  const conn = await getTenantConnectionFromEvent(event)
  const snap = tenantUserFieldsFromAuth(event.context.auth)

  console.log('[SendCampaignAPI] restart', { campaignId, dbName: conn.db?.databaseName })

  return restartCampaignSend(conn, campaignId, {
    auth: event.context.auth,
    ...(snap ? { mergeUserSnapshot: snap } : {})
  })
})
