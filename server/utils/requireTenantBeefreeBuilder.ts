import { getRegistryConnection } from '@server/lib/mongoose'
import {
  isRegisteredTenantAuthContext,
  type RegisteredTenantAuthContext
} from '@server/tenant/registry-auth'
import { parseAllowTenantBeefreeBuilder } from '~~/shared/allowTenantBeefreeBuilder'

/** Ensure tenant auth + superadmin Beefree toggle is ON. */
export async function requireTenantBeefreeBuilder(
  event: { context: { auth?: unknown } },
  disabledMessage = 'Email builder is disabled for this tenant'
): Promise<{ dbName: string; auth: RegisteredTenantAuthContext }> {
  const auth = event.context.auth
  if (!isRegisteredTenantAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Missing or invalid tenant context' })
  }
  const dbName = typeof auth.dbName === 'string' ? auth.dbName : ''
  if (!dbName) {
    throw createError({ statusCode: 403, message: 'Missing or invalid tenant context' })
  }
  const registry = await getRegistryConnection()
  const regDoc = await registry.collection('clients').findOne(
    { dbName },
    { projection: { allowTenantBeefreeBuilder: 1 } }
  )
  if (!parseAllowTenantBeefreeBuilder(regDoc?.allowTenantBeefreeBuilder)) {
    throw createError({ statusCode: 403, message: disabledMessage })
  }
  return { dbName, auth }
}
