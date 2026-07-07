import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { getCampaignSendProgress } from '@server/services/send-campaign.service'
import { assertAdminAuth, getAdminTenantConnection } from '@server/utils/admin/adminCampaigns'

export default defineEventHandler(async (event) => {
  assertAdminAuth(event)

  const dbName = String(getRouterParam(event, 'dbName') ?? '').trim()
  const campaignId = String(getRouterParam(event, 'campaignId') ?? '').trim()
  if (!campaignId) throw createError({ statusCode: 400, message: 'campaignId is required' })

  const conn = await getAdminTenantConnection(dbName)
  const models = getTenantClientModels(conn)

  return getCampaignSendProgress(models, campaignId)
})
