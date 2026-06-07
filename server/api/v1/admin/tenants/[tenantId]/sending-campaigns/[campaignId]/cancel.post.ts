import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { cancelCampaignSend } from '@server/services/cancelCampaignSend.service'
import { getTenantConnectionByTenantId } from '@server/tenant/connection'
import { requireAdminTenantScope } from '@server/utils/admin/requireAdminTenantScope'

export default defineEventHandler(async (event) => {
  const scope = await requireAdminTenantScope(event, getRouterParam(event, 'tenantId'))
  const campaignId = String(getRouterParam(event, 'campaignId') ?? '').trim()
  if (!campaignId) {
    throw createError({ statusCode: 400, message: 'campaignId is required' })
  }

  const body = (await readBody(event).catch(() => ({}))) as { confirm?: boolean; reason?: string }
  if (body.confirm !== true) {
    throw createError({
      statusCode: 400,
      message: 'Set confirm: true to cancel this campaign send'
    })
  }

  const tenantConn = await getTenantConnectionByTenantId(scope.tenantId)
  if (!tenantConn) {
    throw createError({ statusCode: 404, message: 'Tenant not found' })
  }

  const models = getTenantClientModels(tenantConn)
  const report = await cancelCampaignSend(models, campaignId, {
    tenantDbName: scope.dbName,
    tenantName: scope.tenantName,
    reason: body.reason
  })

  return { report }
})
