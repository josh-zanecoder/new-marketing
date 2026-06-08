import {
  listStoredCampaignEmailEvents,
  listStoredTenantEmailEvents,
  storedEventsToReportShape
} from '@server/services/campaignTracking'
import { requireTenantTrackingContext } from '@server/utils/tracking/requireTenantTrackingContext'

const TRACKING_EVENT_LIMIT = 500

export default defineEventHandler(async (event) => {
  const { models, campaignFilter, campaignId } = await requireTenantTrackingContext(event)

  if (campaignId) {
    const stored = await listStoredCampaignEmailEvents(models, {
      campaignId,
      page: 1,
      limit: TRACKING_EVENT_LIMIT
    })

    return {
      source: 'stored' as const,
      report: storedEventsToReportShape(stored.items),
      meta: { total: stored.total, truncated: stored.total > stored.items.length }
    }
  }

  const stored = await listStoredTenantEmailEvents(models, campaignFilter, {
    limit: TRACKING_EVENT_LIMIT
  })

  return {
    source: 'stored' as const,
    report: storedEventsToReportShape(stored.items),
    meta: { total: stored.total, truncated: stored.total > stored.items.length }
  }
})
