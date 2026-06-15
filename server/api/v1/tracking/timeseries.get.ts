import { buildTrackingTimeseries } from '@server/services/campaignTracking'
import { requireTenantTrackingContext } from '@server/utils/tracking/requireTenantTrackingContext'

export default defineEventHandler(async (event) => {
  const { models, campaignFilter, campaignId } = await requireTenantTrackingContext(event)

  const daysRaw = Number(getQuery(event).days ?? 14)
  const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(90, Math.floor(daysRaw))) : 14

  return buildTrackingTimeseries(models, { campaignFilter, campaignId, days })
})
