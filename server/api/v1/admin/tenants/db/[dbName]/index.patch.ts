import { getRegistryConnection } from '../../../../../../lib/mongoose'
import { isAdminAuthContext } from '../../../../../../tenant/registry-auth'
import { invalidateTenantTopicCacheForDbName } from '../../../../../../services/kafkaProducer'
import type { RegistryTenantDoc, TenantAdminRow } from '../../../../../../types/registry/registryTenant.types'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

  if (!name || !dbName || !createdAt) return null
  return { name, email, dbName, tenantId, apiKeyPrefix, createdAt, crmAppUrl }
}

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

  const body = await readBody<{
    name?: string
    email?: string | null
    crmAppUrl?: string | null
    tenantId?: string | null
  }>(event)

  const displayName = body?.name?.trim()
  if (!displayName) {
    throw createError({ statusCode: 400, message: 'name is required' })
  }

  if (body?.email === undefined) {
    throw createError({ statusCode: 400, message: 'email is required (string or null)' })
  }

  let contactEmail: string | null = null
  if (body.email !== null && String(body.email).trim() !== '') {
    const e = String(body.email).trim().toLowerCase()
    if (!EMAIL_RE.test(e)) {
      throw createError({ statusCode: 400, message: 'Invalid email address' })
    }
    contactEmail = e
  }

  let crmAppUrl: string | null = null
  const rawCrm = body?.crmAppUrl
  if (rawCrm === undefined) {
    throw createError({ statusCode: 400, message: 'crmAppUrl is required (string or null)' })
  }
  if (rawCrm !== null && String(rawCrm).trim() !== '') {
    const u = String(rawCrm).trim().replace(/\/+$/, '')
    if (!/^https?:\/\//i.test(u)) {
      throw createError({
        statusCode: 400,
        message: 'CRM app URL must start with http:// or https://'
      })
    }
    crmAppUrl = u
  }

  if (body?.tenantId === undefined) {
    throw createError({ statusCode: 400, message: 'tenantId is required (string or null)' })
  }
  const tenantId =
    body.tenantId === null || String(body.tenantId).trim() === ''
      ? null
      : String(body.tenantId).trim()

  const registryConn = await getRegistryConnection()
  const existing = (await registryConn
    .collection('clients')
    .findOne({ dbName })) as RegistryTenantDoc | null

  if (!existing) {
    throw createError({ statusCode: 404, message: 'Tenant not found' })
  }

  const existingTenantId =
    typeof existing.tenantId === 'string' && existing.tenantId
      ? existing.tenantId
      : null

  if (tenantId && tenantId !== existingTenantId) {
    const dup = await registryConn.collection('clients').findOne({
      tenantId,
      dbName: { $ne: dbName }
    })
    if (dup) {
      throw createError({ statusCode: 409, message: 'tenantId is already in use' })
    }
  }

  await registryConn.collection('clients').updateOne(
    { dbName },
    {
      $set: {
        name: displayName,
        email: contactEmail,
        crmAppUrl,
        tenantId
      }
    }
  )

  invalidateTenantTopicCacheForDbName(dbName)

  const doc = await registryConn.collection('clients').findOne({ dbName })
  const tenant = doc ? toTenantAdminRow(doc as RegistryTenantDoc) : null
  if (!tenant) {
    throw createError({ statusCode: 500, message: 'Failed to load updated tenant' })
  }

  return { ok: true, tenant }
})
