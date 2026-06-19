import { loadScopedBrevoTrackingEvents } from '@server/utils/tracking/loadScopedBrevoTrackingEvents'
import {
  isRegisteredTenantAuthContext,
  type RegisteredTenantAuthContext
} from '@server/tenant/registry-auth'

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

  const { events, error } = await loadScopedBrevoTrackingEvents(event, tenantAuth)
  if (error) {
    throw createError({ statusCode: 502, statusMessage: error })
  }

  return { report: { events } }
})
