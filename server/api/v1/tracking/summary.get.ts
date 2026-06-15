import { buildTrackingSummary } from '@server/services/campaignTracking'
import { requireTenantTrackingContext } from '@server/utils/tracking/requireTenantTrackingContext'

export default defineEventHandler(async (event) => {
  const { models, campaignFilter, campaignId } = await requireTenantTrackingContext(event)
  return buildTrackingSummary(models, { campaignFilter, campaignId })
})
