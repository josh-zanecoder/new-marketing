import { assertAdminTrackingAuth, syncAdminTrackingReport } from '@server/utils/tracking/adminTracking'

export default defineEventHandler(async (event) => {
  assertAdminTrackingAuth(event)
  return syncAdminTrackingReport(event)
})
