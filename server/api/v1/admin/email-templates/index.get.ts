import { assertAdminAuth } from '@server/utils/admin/adminCampaigns'
import { listAdminEmailTemplates } from '@server/utils/admin/listAdminEmailTemplates'

export default defineEventHandler(async (event) => {
  assertAdminAuth(event)
  const query = getQuery(event)
  const tenantDbName = String(query.tenantDbName ?? '').trim() || undefined
  const search = String(query.search ?? '').trim() || undefined
  const page = Number(query.page)
  const limit = Number(query.limit)
  return listAdminEmailTemplates({
    tenantDbName,
    search,
    page: Number.isFinite(page) ? page : undefined,
    limit: Number.isFinite(limit) ? limit : undefined
  })
})
