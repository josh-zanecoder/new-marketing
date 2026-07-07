import { assertAdminTrackingAuth, fetchAdminTrackingReport } from '@server/utils/tracking/adminTracking'

export default defineEventHandler(async (event) => {
  assertAdminTrackingAuth(event)
  return fetchAdminTrackingReport(event)
})
