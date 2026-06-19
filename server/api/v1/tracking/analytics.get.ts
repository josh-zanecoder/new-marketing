import {
  isRegisteredTenantAuthContext,
  type RegisteredTenantAuthContext
} from '@server/tenant/registry-auth'
import { computeMarketingAnalytics } from '@server/utils/tracking/computeMarketingAnalytics'
import { loadScopedBrevoTrackingEvents } from '@server/utils/tracking/loadScopedBrevoTrackingEvents'

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

  const { events, fromYmd, toYmd, error } = await loadScopedBrevoTrackingEvents(event, tenantAuth)
  if (error) {
    throw createError({ statusCode: 502, statusMessage: error })
  }

  const analytics = computeMarketingAnalytics(events, fromYmd, toYmd)

  return { analytics }
})
