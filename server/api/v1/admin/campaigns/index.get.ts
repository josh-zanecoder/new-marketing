import { assertAdminAuth, listAdminCampaignsForIndex } from '@server/utils/admin/adminCampaigns'

export default defineEventHandler(async (event) => {
  assertAdminAuth(event)

  const query = getQuery(event)
  const tenantDbName = String(query.tenantDbName ?? '').trim() || undefined
  const search = String(query.search ?? '').trim() || undefined
  const status = String(query.status ?? '').trim() || undefined

  return listAdminCampaignsForIndex({ tenantDbName, search, status })
})
