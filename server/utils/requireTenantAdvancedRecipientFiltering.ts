import type { H3Event } from 'h3'
import { getRegistryConnection } from '@server/lib/mongoose'
import {
  isRegisteredTenantAuthContext,
  type RegisteredTenantAuthContext
} from '@server/tenant/registry-auth'
import { parseAllowTenantAdvancedRecipientFiltering } from '~~/shared/allowTenantAdvancedRecipientFiltering'

/** Ensure tenant auth + Advanced Recipient Filtering toggle is ON. */
export async function requireTenantAdvancedRecipientFiltering(
  event: H3Event,
  disabledMessage = 'Advanced recipient filtering is disabled for this tenant'
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
    { projection: { allowTenantAdvancedRecipientFiltering: 1 } }
  )
  if (!parseAllowTenantAdvancedRecipientFiltering(regDoc?.allowTenantAdvancedRecipientFiltering)) {
    throw createError({ statusCode: 403, message: disabledMessage })
  }
  return { dbName, auth }
}
