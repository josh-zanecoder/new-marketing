import { haltAllActiveCampaignSends } from '@server/services/campaign-send-control.service'
import { assertAdminAuth, getAdminTenantConnection } from '@server/utils/admin/adminCampaigns'

export default defineEventHandler(async (event) => {
  assertAdminAuth(event)

  const dbName = String(getRouterParam(event, 'dbName') ?? '').trim()
  const conn = await getAdminTenantConnection(dbName)
  return haltAllActiveCampaignSends(conn, { mode: 'stop' })
})
