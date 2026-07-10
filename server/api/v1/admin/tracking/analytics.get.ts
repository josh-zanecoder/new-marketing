import { computeMarketingAnalytics } from '@server/utils/tracking/computeMarketingAnalytics'
import { normalizeCampaignIdQuery, normalizeYmdQuery } from '@server/utils/tracking/brevoTenantEvents'
import {
  assertAdminTrackingAuth,
  fetchAdminTrackingReport
} from '@server/utils/tracking/adminTracking'

export default defineEventHandler(async (event) => {
  assertAdminTrackingAuth(event)

  const fromYmd = normalizeYmdQuery(event, 'from')
  const toYmd = normalizeYmdQuery(event, 'to')
  normalizeCampaignIdQuery(event)

  const { report } = await fetchAdminTrackingReport(event)
  const analytics = computeMarketingAnalytics(report.events, fromYmd, toYmd)

  return { analytics }
})
