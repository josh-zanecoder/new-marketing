import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { getRegistryConnection } from '@server/lib/mongoose'
import { ADMIN_PAUSE_REASON, pauseCampaignSend } from '@server/services/cancelCampaignSend.service'
import { getTenantConnectionByDbName } from '@server/tenant/connection'
import { isAdminAuthContext } from '@server/tenant/registry-auth'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as unknown
  if (!isAdminAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const dbName = decodeURIComponent(String(getRouterParam(event, 'dbName') ?? '').trim())
  const campaignId = String(getRouterParam(event, 'campaignId') ?? '').trim()
  if (!dbName || !campaignId) {
    throw createError({ statusCode: 400, message: 'dbName and campaignId are required' })
  }

  const body = (await readBody(event).catch(() => ({}))) as { confirm?: boolean; reason?: string }
  if (body.confirm !== true) {
    throw createError({
      statusCode: 400,
      message: 'Set confirm: true to pause this campaign send'
    })
  }

  const registry = await getRegistryConnection()
  const tenantRow = await registry.collection('clients').findOne({ dbName })
  const tenantName =
    tenantRow && typeof tenantRow.name === 'string' && tenantRow.name.trim()
      ? tenantRow.name.trim()
      : dbName

  const tenantConn = await getTenantConnectionByDbName(dbName)
  const models = getTenantClientModels(tenantConn)

  const report = await pauseCampaignSend(models, campaignId, {
    tenantDbName: dbName,
    tenantName,
    reason: body.reason ?? ADMIN_PAUSE_REASON
  })

  return { report }
})
