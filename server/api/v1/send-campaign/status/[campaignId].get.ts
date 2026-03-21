import { getTenantClientModels } from '../../../../models/clients/tenantClientModels'
import { getCampaignSendProgress } from '../../../../services/send-campaign.service'
import { getTenantConnectionFromEvent } from '../../../../utils/tenantDb'

export default defineEventHandler(async (event) => {
  const campaignId = getRouterParam(event, 'campaignId')
  if (!campaignId) throw createError({ statusCode: 400, message: 'campaignId is required' })

  const conn = await getTenantConnectionFromEvent(event)
  const models = getTenantClientModels(conn)

  return getCampaignSendProgress(models, campaignId)
})
