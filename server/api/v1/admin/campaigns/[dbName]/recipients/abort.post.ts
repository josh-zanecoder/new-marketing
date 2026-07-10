import { abortCampaignRecipients } from '@server/services/campaign-send-control.service'
import { assertAdminAuth, getAdminTenantConnection } from '@server/utils/admin/adminCampaigns'

export default defineEventHandler(async (event) => {
  assertAdminAuth(event)

  const dbName = String(getRouterParam(event, 'dbName') ?? '').trim()
  const body = await readBody<{ campaignId: string; emails: string[] }>(event)
  const campaignId = String(body?.campaignId ?? '').trim()
  const emails = Array.isArray(body?.emails) ? body.emails : []
  if (!campaignId) throw createError({ statusCode: 400, message: 'campaignId is required' })

  const conn = await getAdminTenantConnection(dbName)
  return abortCampaignRecipients(conn, campaignId, emails)
})
