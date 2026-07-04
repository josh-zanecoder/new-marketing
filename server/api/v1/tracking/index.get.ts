import { getRegistryConnection } from '@server/lib/mongoose'
import {
  isRegisteredTenantAuthContext,
  resolveTenantIdForTenantAuth,
  type RegisteredTenantAuthContext
} from '@server/tenant/registry-auth'
import { loadTenantBrevoTrackingEvents } from '@server/utils/tracking/loadTenantBrevoTrackingEvents'
import {
  normalizeCampaignIdQuery,
  normalizeYmdQuery
} from '@server/utils/tracking/brevoTenantEvents'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth || typeof auth !== 'object') {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  if (!isRegisteredTenantAuthContext(auth)) {
    throw createError({
      statusCode: 403,
      message: 'Tenant session required for tracking'
    })
  }

  const tenantAuth = auth as RegisteredTenantAuthContext
  const dbName = tenantAuth.dbName.trim()
  if (!dbName) {
    throw createError({ statusCode: 403, message: 'Missing tenant database context' })
  }

  const registryConn = await getRegistryConnection()
  const marketingTenantId = await resolveTenantIdForTenantAuth(registryConn, tenantAuth)

  const campaignId = normalizeCampaignIdQuery(event)
  const fromYmd = normalizeYmdQuery(event, 'from')
  const toYmd = normalizeYmdQuery(event, 'to')

  const { events, error } = await loadTenantBrevoTrackingEvents(dbName, marketingTenantId, {
    campaignId,
    fromYmd,
    toYmd
  })

  if (error) {
    throw createError({ statusCode: 502, statusMessage: error })
  }

  return { report: { events } }
})
