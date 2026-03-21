import { getTenantClientModels } from '../../../../models/tenant/tenantClientModels'
import { getCampaignSendProgress } from '../../../../services/send-campaign.service'
import { getTenantConnectionFromEvent } from '../../../../tenant/connection'

export default defineEventHandler(async (event) => {
  const campaignId = getRouterParam(event, 'campaignId')
  if (!campaignId) throw createError({ statusCode: 400, message: 'campaignId is required' })

  const conn = await getTenantConnectionFromEvent(event)
  const models = getTenantClientModels(conn)

  return getCampaignSendProgress(models, campaignId)
})
