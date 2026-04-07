import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { getCampaignSendProgress } from '@server/services/send-campaign.service'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'

export default defineEventHandler(async (event) => {
  const campaignId = String(getRouterParam(event, 'campaignId') ?? '').trim()
  if (!campaignId) throw createError({ statusCode: 400, message: 'campaignId is required' })

  const conn = await getTenantConnectionFromEvent(event)
  const models = getTenantClientModels(conn)

  return getCampaignSendProgress(models, campaignId, event.context.auth)
})
