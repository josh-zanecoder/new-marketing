import { getRegistryConnection } from '@server/lib/mongoose'
import { isAdminAuthContext } from '@server/tenant/registry-auth'
import type { RegistryTenantDoc } from '@server/types/registry/registryTenant.types'
import { toTenantAdminRow } from '@server/utils/registry/tenantAdminRow'

/** Resolve a tenant by registry database name (for admin URLs that use `dbName` in the path). */
export default defineEventHandler(async (event) => {
  const auth = event.context.auth as unknown
  if (!isAdminAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const raw = getRouterParam(event, 'dbName') ?? ''
  const dbName = decodeURIComponent(raw)
  if (!dbName) {
    throw createError({ statusCode: 400, message: 'Missing tenant db name' })
  }

  const registryConn = await getRegistryConnection()
  const doc = await registryConn.collection('clients').findOne({ dbName })
  if (!doc) {
    throw createError({ statusCode: 404, message: 'Tenant not found' })
  }

  const tenant = toTenantAdminRow(doc as RegistryTenantDoc)
  if (!tenant) {
    throw createError({ statusCode: 404, message: 'Tenant not found' })
  }

  return { tenant }
})
