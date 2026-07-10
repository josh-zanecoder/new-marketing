import { assertAdminAuth, getAdminTenantConnection } from '@server/utils/admin/adminCampaigns'
import { fetchAdminCampaignDetail } from '@server/utils/admin/fetchAdminCampaignDetail'

export default defineEventHandler(async (event) => {
  assertAdminAuth(event)

  const dbName = String(getRouterParam(event, 'dbName') ?? '').trim()
  const campaignId = String(getRouterParam(event, 'campaignId') ?? '').trim()
  if (!campaignId) throw createError({ statusCode: 400, message: 'campaignId is required' })

  const conn = await getAdminTenantConnection(dbName)
  return fetchAdminCampaignDetail(conn, campaignId)
})
