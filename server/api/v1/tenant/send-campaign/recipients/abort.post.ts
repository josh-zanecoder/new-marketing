import { abortCampaignRecipients } from '@server/services/campaign-send-control.service'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ campaignId: string; emails: string[] }>(event)
  const campaignId = String(body?.campaignId ?? '').trim()
  const emails = Array.isArray(body?.emails) ? body.emails : []
  if (!campaignId) throw createError({ statusCode: 400, message: 'campaignId is required' })

  const conn = await getTenantConnectionFromEvent(event)
  console.log('[SendCampaignAPI] abortRecipients', {
    campaignId,
    count: emails.length,
    dbName: conn.db?.databaseName
  })

  return abortCampaignRecipients(conn, campaignId, emails, { auth: event.context.auth })
})
