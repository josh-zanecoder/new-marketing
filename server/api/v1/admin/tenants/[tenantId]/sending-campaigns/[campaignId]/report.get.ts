import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import {
  buildCampaignSendCancelReport,
  getCampaignSendReportRecipients,
  type CampaignSendReportRecipientFilter
} from '@server/services/cancelCampaignSend.service'
import { getTenantConnectionByTenantId } from '@server/tenant/connection'
import { requireAdminTenantScope } from '@server/utils/admin/requireAdminTenantScope'

function parseFilter(raw: string | undefined): CampaignSendReportRecipientFilter {
  const s = String(raw ?? '').trim().toLowerCase()
  if (s === 'sent' || s === 'notsent' || s === 'not_sent') return s === 'sent' ? 'sent' : 'notSent'
  if (s === 'pending' || s === 'failed' || s === 'cancelled') return s
  if (s === 'all') return 'all'
  return 'all'
}

function parseLegacyGroup(raw: string | undefined): 'sent' | 'notSent' | null {
  const s = String(raw ?? '').trim().toLowerCase()
  if (s === 'sent') return 'sent'
  if (s === 'notsent' || s === 'not_sent') return 'notSent'
  return null
}

export default defineEventHandler(async (event) => {
  const scope = await requireAdminTenantScope(event, getRouterParam(event, 'tenantId'))
  const campaignId = String(getRouterParam(event, 'campaignId') ?? '').trim()
  if (!campaignId) {
    throw createError({ statusCode: 400, message: 'campaignId is required' })
  }

  const query = getQuery(event)
  const groupLegacy = parseLegacyGroup(query.group as string | undefined)
  const filterRaw = (query.filter ?? query.status ?? query.group) as string | undefined
  const pageRaw = query.page as string | undefined
  const limitRaw = query.limit as string | undefined
  const search = String(query.search ?? '').trim()

  const tenantConn = await getTenantConnectionByTenantId(scope.tenantId)
  if (!tenantConn) {
    throw createError({ statusCode: 404, message: 'Tenant not found' })
  }

  const models = getTenantClientModels(tenantConn)

  if (groupLegacy || filterRaw) {
    const filter = groupLegacy ?? parseFilter(filterRaw)
    return getCampaignSendReportRecipients(models, {
      campaignId,
      filter,
      page: Math.max(1, Number(pageRaw ?? 1) || 1),
      limit: Math.min(200, Math.max(1, Number(limitRaw ?? 50) || 50)),
      search: search || undefined
    })
  }

  const report = await buildCampaignSendCancelReport(models, {
    tenantDbName: scope.dbName,
    tenantName: scope.tenantName,
    campaignId
  })
  return { report }
})
