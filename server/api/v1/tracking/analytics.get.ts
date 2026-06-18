import { getTransactionalEmailEventReport } from '@server/services/brevo.service'
import { getRegistryConnection } from '@server/lib/mongoose'
import {
  isRegisteredTenantAuthContext,
  resolveTenantIdForTenantAuth,
  type RegisteredTenantAuthContext
} from '@server/tenant/registry-auth'
import { computeMarketingAnalytics } from '@server/utils/tracking/computeMarketingAnalytics'
import {
  extractBrevoEventsFromReport,
  filterBrevoEventsForTenant,
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
      message: 'Tenant session required for analytics'
    })
  }

  const tenantAuth = auth as RegisteredTenantAuthContext
  const dbName = tenantAuth.dbName.trim()
  if (!dbName) {
    throw createError({ statusCode: 403, message: 'Missing tenant database context' })
  }

  const registryConn = await getRegistryConnection()
  const marketingTenantId = await resolveTenantIdForTenantAuth(registryConn, tenantAuth)

  const { report, error } = await getTransactionalEmailEventReport({})
  if (error) {
    throw createError({ statusCode: 502, statusMessage: error })
  }

  const campaignId = normalizeCampaignIdQuery(event)
  const fromYmd = normalizeYmdQuery(event, 'from')
  const toYmd = normalizeYmdQuery(event, 'to')

  const events = filterBrevoEventsForTenant(
    extractBrevoEventsFromReport(report),
    dbName,
    marketingTenantId,
    campaignId
  )

  const analytics = computeMarketingAnalytics(events, fromYmd, toYmd)

  return { analytics }
})
