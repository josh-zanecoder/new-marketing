import {
  listSendingCampaignsForTenantPaginated,
  listStoppedCampaignsForTenantPaginated
} from '@server/services/cancelCampaignSend.service'
import { requireAdminTenantScope } from '@server/utils/admin/requireAdminTenantScope'

function parseView(raw: string | undefined): 'sending' | 'stopped' {
  return String(raw ?? '').trim().toLowerCase() === 'stopped' ? 'stopped' : 'sending'
}

function parseStoppedStatus(raw: string | undefined): 'all' | 'Paused' | 'Cancelled' {
  const s = String(raw ?? '').trim()
  if (s === 'Paused' || s === 'Cancelled') return s
  return 'all'
}

export default defineEventHandler(async (event) => {
  const scope = await requireAdminTenantScope(event, getRouterParam(event, 'tenantId'))

  setResponseHeader(event, 'Cache-Control', 'no-store')

  const query = getQuery(event)
  const view = parseView(query.view as string | undefined)
  const page = Math.max(1, Number(query.page ?? 1) || 1)
  const limit = Math.min(50, Math.max(1, Number(query.limit ?? 10) || 10))
  const status = parseStoppedStatus(query.status as string | undefined)

  if (view === 'stopped') {
    return listStoppedCampaignsForTenantPaginated(scope.dbName, scope.tenantName, {
      page,
      limit,
      status
    })
  }

  return listSendingCampaignsForTenantPaginated(scope.dbName, scope.tenantName, { page, limit })
})
