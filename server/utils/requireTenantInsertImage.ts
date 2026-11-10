import { getRegistryConnection } from '@server/lib/mongoose'
import {
  isRegisteredTenantAuthContext,
  type RegisteredTenantAuthContext
} from '@server/tenant/registry-auth'
import { parseAllowTenantInsertImage } from '~~/shared/allowTenantInsertImage'

/** Ensure tenant auth + superadmin Insert image permission is ON. */
export async function requireTenantInsertImage(
  event: { context: { auth?: unknown } },
  disabledMessage = 'Insert image is disabled for this tenant'
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
    { projection: { allowTenantInsertImage: 1 } }
  )
  if (!parseAllowTenantInsertImage(regDoc?.allowTenantInsertImage)) {
    throw createError({ statusCode: 403, message: disabledMessage })
  }
  return { dbName, auth }
}
