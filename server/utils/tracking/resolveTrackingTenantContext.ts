import type { H3Event } from 'h3'
import { getRegistryConnection } from '@server/lib/mongoose'
import { ADMIN_TENANT_DB_HEADER } from '@server/constants/adminTenantProxy.constants'
import {
  findRegistryTenantByDbName,
  isAdminAuthContext,
  isRegisteredTenantAuthContext,
  resolveTenantIdForTenantAuth
} from '@server/tenant/registry-auth'

export type TrackingTenantContext = {
  dbName: string
  marketingTenantId: string | null
}

export async function resolveTrackingTenantContext(
  event: H3Event
): Promise<TrackingTenantContext> {
  const auth = event.context.auth
  if (!auth || typeof auth !== 'object') {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const registryConn = await getRegistryConnection()

  if (isRegisteredTenantAuthContext(auth)) {
    const dbName = auth.dbName.trim()
    if (!dbName) {
      throw createError({ statusCode: 403, message: 'Missing tenant database context' })
    }
    const marketingTenantId = await resolveTenantIdForTenantAuth(registryConn, auth)
    return { dbName, marketingTenantId }
  }

  if (isAdminAuthContext(auth)) {
    const adminTenantDb = (getHeader(event, ADMIN_TENANT_DB_HEADER) || '').trim()
    if (!adminTenantDb) {
      throw createError({
        statusCode: 403,
        message: 'Tenant database required for admin tracking'
      })
    }
    const row = await findRegistryTenantByDbName(registryConn, adminTenantDb)
    if (!row) {
      throw createError({
        statusCode: 403,
        message: 'Unknown tenant for admin tracking'
      })
    }
    const marketingTenantId =
      typeof row.tenantId === 'string' && row.tenantId.trim() ? row.tenantId.trim() : null
    return { dbName: row.dbName, marketingTenantId }
  }

  throw createError({
    statusCode: 403,
    message: 'Tenant session required for tracking'
  })
}
