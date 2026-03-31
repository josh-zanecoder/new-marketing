import type { H3Event } from 'h3'
import { getRegistryConnection } from '../lib/mongoose'
import {
  isAdminAuthContext,
  isRegisteredTenantAuthContext,
  isTenantApiKeyAuthContext,
  resolveTenantIdForTenantAuth,
  findRegistryTenantByDbName
} from './registry-auth'

export async function buildTenantMeResponse(event: H3Event) {
  const auth = event.context.auth as unknown
  if (!auth || typeof auth !== 'object') {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  if (isAdminAuthContext(auth)) {
    throw createError({
      statusCode: 403,
      message: 'Tenant-scoped routes require a tenant session or tenant API key'
    })
  }
  if (!isRegisteredTenantAuthContext(auth)) {
    throw createError({
      statusCode: 403,
      message: 'Missing or invalid tenant context'
    })
  }

  const registryConn = await getRegistryConnection()
  const tenantId = await resolveTenantIdForTenantAuth(registryConn, auth)
  const row = await findRegistryTenantByDbName(registryConn, auth.dbName)

  const tenantNameFromKey = isTenantApiKeyAuthContext(auth)
    ? auth.tenantName
    : null

  return {
    tenantId: tenantId ?? row?.tenantId ?? null,
    dbName: auth.dbName,
    tenantName: row?.tenantName ?? tenantNameFromKey ?? null,
    crmAppUrl: row?.crmAppUrl ?? null
  }
}
