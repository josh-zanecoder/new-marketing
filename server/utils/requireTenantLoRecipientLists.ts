import { getRegistryConnection } from '@server/lib/mongoose'
import {
  isRegisteredTenantAuthContext,
  type RegisteredTenantAuthContext
} from '@server/tenant/registry-auth'
import { parseAllowTenantLoRecipientLists } from '~~/shared/allowTenantLoRecipientLists'

/** Ensure tenant auth + superadmin LO recipient-lists toggle is ON. */
export async function requireTenantLoRecipientLists(
  event: { context: { auth?: unknown } },
  disabledMessage = 'This feature is disabled for this tenant'
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
    { projection: { allowTenantLoRecipientLists: 1 } }
  )
  if (!parseAllowTenantLoRecipientLists(regDoc?.allowTenantLoRecipientLists)) {
    throw createError({ statusCode: 403, message: disabledMessage })
  }
  return { dbName, auth }
}
