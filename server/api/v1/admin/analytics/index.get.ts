import { assertAdminAuth } from '@server/utils/admin/adminCampaigns'
import { listAdminAnalytics } from '@server/utils/admin/listAdminAnalytics'

export default defineEventHandler(async (event) => {
  assertAdminAuth(event)
  const query = getQuery(event)
  const from = String(query.from ?? '').trim()
  const to = String(query.to ?? '').trim()
  const tenantDbName = String(query.tenantDbName ?? '').trim() || undefined
  const tzRaw = Number(query.tzOffset)
  return listAdminAnalytics({
    from,
    to,
    tenantDbName,
    tzOffsetMinutes: Number.isFinite(tzRaw) ? tzRaw : 0
  })
})
