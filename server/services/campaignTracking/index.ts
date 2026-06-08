export type {
  CampaignTrackingSummary,
  CampaignTrackingTimeseriesPoint,
  StoredEmailEventRecord,
  TrackingEventReport
} from './types'

export { classifyEngagementEvent } from './classifyEngagementEvent'
export { applyCampaignEmailWebhook, applyCampaignBrevoWebhook } from './webhookIngest.service'
export { buildCampaignTrackingSummary, buildCampaignTrackingTimeseries } from './analytics.service'
export {
  listStoredCampaignEmailEvents,
  listStoredTenantEmailEvents,
  storedEventsToReportShape,
  storedEventsToBrevoReportShape
} from './eventsQuery.service'
