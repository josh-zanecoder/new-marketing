import { getRegistryConnection } from '../../../../../../lib/mongoose'
import { isAdminAuthContext } from '../../../../../../tenant/registry-auth'
import type { RegistryTenantDoc, TenantAdminRow } from '../../../../../../types/registry/registryTenant.types'

function toTenantAdminRow(doc: RegistryTenantDoc): TenantAdminRow | null {
  const name = typeof doc.name === 'string' ? doc.name : ''
  const email = typeof doc.email === 'string' ? doc.email : null
  const dbName = typeof doc.dbName === 'string' ? doc.dbName : ''
  const tenantId =
    typeof doc.tenantId === 'string' && doc.tenantId ? doc.tenantId : null
  const apiKeyPrefix =
    typeof doc.clientKeyPrefix === 'string' && doc.clientKeyPrefix
      ? doc.clientKeyPrefix
      : typeof doc.apiKeyPrefix === 'string' && doc.apiKeyPrefix
        ? doc.apiKeyPrefix
        : null
  const createdAt =
    doc.createdAt instanceof Date
      ? doc.createdAt.toISOString()
      : typeof doc.createdAt === 'string'
        ? new Date(doc.createdAt).toISOString()
        : null

  if (!name || !dbName || !createdAt) return null
  return { name, email, dbName, tenantId, apiKeyPrefix, createdAt }
}

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
