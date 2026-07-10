import { restartCampaignSend } from '@server/services/campaign-send-control.service'
import { assertAdminAuth, getAdminTenantConnection } from '@server/utils/admin/adminCampaigns'

export default defineEventHandler(async (event) => {
  assertAdminAuth(event)

  const dbName = String(getRouterParam(event, 'dbName') ?? '').trim()
  const body = await readBody<{ campaignId: string }>(event)
  const campaignId = String(body?.campaignId ?? '').trim()
  if (!campaignId) throw createError({ statusCode: 400, message: 'campaignId is required' })

  const conn = await getAdminTenantConnection(dbName)
  return restartCampaignSend(conn, campaignId)
})
