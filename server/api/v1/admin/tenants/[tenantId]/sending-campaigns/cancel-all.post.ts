import { cancelAllSendingCampaignsForTenant } from '@server/services/cancelCampaignSend.service'
import { requireAdminTenantScope } from '@server/utils/admin/requireAdminTenantScope'

export default defineEventHandler(async (event) => {
  const scope = await requireAdminTenantScope(event, getRouterParam(event, 'tenantId'))

  const body = (await readBody(event).catch(() => ({}))) as { confirm?: boolean; reason?: string }
  if (body.confirm !== true) {
    throw createError({
      statusCode: 400,
      message: 'Set confirm: true to cancel all sending campaigns for this tenant'
    })
  }

  const reports = await cancelAllSendingCampaignsForTenant(scope.dbName, scope.tenantName, {
    reason: body.reason
  })

  return { reports, total: reports.length }
})
