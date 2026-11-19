import { assertAdminAuth } from '@server/utils/admin/adminCampaigns'
import { clearMarketingSyncTenantHealth } from '@server/utils/marketingSyncHealth/store'

export default defineEventHandler(async (event) => {
  assertAdminAuth(event)

  const dbName = decodeURIComponent(String(getRouterParam(event, 'dbName') || '')).trim()
  if (!dbName) {
    throw createError({ statusCode: 400, statusMessage: 'dbName is required' })
  }

  const body = await readBody<{ tenantId?: string }>(event).catch(() => ({} as { tenantId?: string }))
  const tenantId = typeof body?.tenantId === 'string' ? body.tenantId.trim() : ''

  const ok = await clearMarketingSyncTenantHealth({ dbName, tenantId: tenantId || undefined })
  if (!ok) {
    throw createError({
      statusCode: 404,
      statusMessage: 'No sync health document found for this tenant'
    })
  }

  return { ok: true, dbName, action: 'clear' as const }
})
