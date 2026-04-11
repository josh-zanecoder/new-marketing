import { getRegistryConnection } from '@server/lib/mongoose'
import { isAdminAuthContext } from '@server/tenant/registry-auth'
import type { RegistryTenantDoc, TenantAdminRow } from '@server/types/registry/registryTenant.types'

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

  const crmRaw = doc.crmAppUrl
  const crmAppUrl =
    typeof crmRaw === 'string' && crmRaw.trim()
      ? crmRaw.trim().replace(/\/+$/, '')
      : null

  const koRaw = doc.kafkaOutboundTopic
  const kafkaOutboundTopic =
    typeof koRaw === 'string' && koRaw.trim() ? koRaw.trim() : null

  if (!name || !dbName || !createdAt) return null
  /** `tenantId` is included for admin UI and APIs keyed by registry id (e.g. recipient filters). */
  return { name, email, dbName, tenantId, apiKeyPrefix, createdAt, crmAppUrl, kafkaOutboundTopic }
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as unknown
  if (!isAdminAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const registryConn = await getRegistryConnection()

  const rawDocs = (await registryConn
    .collection('clients')
    .find({})
    .sort({ createdAt: -1 })
    .toArray()) as unknown[]

  const tenants: TenantAdminRow[] = rawDocs
    .map((d) => toTenantAdminRow(d as RegistryTenantDoc))
    .filter((c): c is TenantAdminRow => !!c)

  return { tenants }
})
