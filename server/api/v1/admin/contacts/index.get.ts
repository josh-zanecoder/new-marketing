import { assertAdminAuth } from '@server/utils/admin/adminCampaigns'
import { listAdminContacts } from '@server/utils/admin/listAdminContacts'

export default defineEventHandler(async (event) => {
  assertAdminAuth(event)

  const query = getQuery(event)
  const tenantDbName = String(query.tenantDbName ?? '').trim() || undefined
  const search = String(query.search ?? '').trim() || undefined
  const subscription = String(query.subscription ?? '').trim() || undefined
  const page = Number(query.page)
  const limit = Number(query.limit)

  return listAdminContacts({
    tenantDbName,
    search,
    subscription,
    page: Number.isFinite(page) ? page : undefined,
    limit: Number.isFinite(limit) ? limit : undefined
  })
})
