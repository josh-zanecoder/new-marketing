import { assertAdminAuth } from '@server/utils/admin/adminCampaigns'
import { listAdminDashboard } from '@server/utils/admin/listAdminDashboard'

export default defineEventHandler(async (event) => {
  assertAdminAuth(event)
  return listAdminDashboard()
})
