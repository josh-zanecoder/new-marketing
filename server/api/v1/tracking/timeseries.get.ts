import { buildCampaignTrackingTimeseries } from '@server/services/campaignTracking'
import { requireCampaignTrackingAccess } from '@server/utils/tracking/requireCampaignTrackingAccess'

export default defineEventHandler(async (event) => {
  const { models, campaignId } = await requireCampaignTrackingAccess(event)

  const daysRaw = Number(getQuery(event).days ?? 14)
  const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(90, Math.floor(daysRaw))) : 14

  return buildCampaignTrackingTimeseries(models, campaignId, days)
})
