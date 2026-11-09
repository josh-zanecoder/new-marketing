import { getRegistryConnection } from '@server/lib/mongoose'
import {
  isRegisteredTenantAuthContext,
  type RegisteredTenantAuthContext
} from '@server/tenant/registry-auth'
import { parseAllowTenantImages } from '~~/shared/allowTenantImages'

/** Ensure tenant auth + superadmin Images toggle is ON. */
export async function requireTenantImages(
  event: { context: { auth?: unknown } },
  disabledMessage = 'Image library is disabled for this tenant'
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
    { projection: { allowTenantImages: 1 } }
  )
  if (!parseAllowTenantImages(regDoc?.allowTenantImages)) {
    throw createError({ statusCode: 403, message: disabledMessage })
  }
  return { dbName, auth }
}
