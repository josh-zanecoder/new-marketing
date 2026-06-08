import { buildCampaignTrackingSummary } from '@server/services/campaignTracking'
import { requireCampaignTrackingAccess } from '@server/utils/tracking/requireCampaignTrackingAccess'

export default defineEventHandler(async (event) => {
  const { models, campaignId } = await requireCampaignTrackingAccess(event)
  return buildCampaignTrackingSummary(models, campaignId)
})
