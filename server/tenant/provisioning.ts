import { randomUUID } from 'node:crypto'
import type { Connection } from 'mongoose'
import {
  generateTenantApiKey,
  hashTenantApiKey,
  getTenantApiKeyPrefix
} from './api-key'
import type { EnsureTenantResult } from '../types/registry/provision.types'
<<<<<<< Updated upstream
import { normalizeTenantSubdomain } from './subdomain'
=======
import { normalizeTenantSubdomainInput } from '../utils/tenant-host'
>>>>>>> Stashed changes

export function toTenantDbName(displayName: string): string {
  const base = displayName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')

  if (!base) {
    throw createError({ statusCode: 400, message: 'name must be a non-empty string' })
  }

  const maxBaseLen = 61
  const truncated = base.slice(0, maxBaseLen)

  return `${truncated}_db`
}

export type { EnsureTenantResult } from '../types/registry/provision.types'

export async function ensureTenantDatabaseInitialized(
  registryConn: Connection,
  displayName: string,
  contactEmail: string | null,
  tenantIdFromBody: string | null = null,
<<<<<<< Updated upstream
  subdomainRaw: string | null = null
=======
  subdomainFromBody: string | null = null
>>>>>>> Stashed changes
): Promise<EnsureTenantResult> {
  const dbName = toTenantDbName(displayName)
  const dbConn = registryConn.useDb(dbName)

  const existing = (await registryConn.collection('clients').findOne({ dbName })) as {
    tenantId?: string
    subdomain?: string
  } | null
  const isNew = !existing
  let subdomain: string | null = null
  if (subdomainRaw != null && subdomainRaw.trim() !== '') {
    subdomain = normalizeTenantSubdomain(subdomainRaw)
  } else if (isNew) {
    throw createError({ statusCode: 400, message: 'subdomain is required for new tenants' })
  } else if (typeof existing?.subdomain === 'string' && existing.subdomain) {
    subdomain = existing.subdomain
  }
  if (subdomain) {
    const dup = await registryConn.collection('clients').findOne({
      subdomain,
      dbName: { $ne: dbName }
    })
    if (dup) throw createError({ statusCode: 409, message: 'subdomain is already in use' })
  }

  let apiKey: string | null = null
  if (isNew) {
    apiKey = generateTenantApiKey()
  }

  const trimmedTenant = tenantIdFromBody?.trim() || null
  const tenantId =
    typeof existing?.tenantId === 'string' && existing.tenantId
      ? existing.tenantId
      : trimmedTenant || randomUUID()
  const trimmedSubdomain = subdomainFromBody ? normalizeTenantSubdomainInput(subdomainFromBody) : null
  const subdomain =
    typeof existing?.subdomain === 'string' && existing.subdomain
      ? existing.subdomain
      : trimmedSubdomain
  if (!subdomain) throw createError({ statusCode: 400, message: 'subdomain is required' })

  if (!existing?.tenantId && trimmedTenant) {
    const dup = await registryConn.collection('clients').findOne({
      tenantId,
      dbName: { $ne: dbName }
    })
    if (dup) {
      throw createError({ statusCode: 409, message: 'tenantId is already in use' })
    }
  }
  if (!(typeof existing?.subdomain === 'string' && existing.subdomain) && trimmedSubdomain) {
    const dupSubdomain = await registryConn.collection('clients').findOne({
      subdomain,
      dbName: { $ne: dbName }
    })
    if (dupSubdomain) throw createError({ statusCode: 409, message: 'subdomain is already in use' })
  }

  await dbConn.collection('clients').updateOne(
    { name: displayName },
    {
      $set: { email: contactEmail, tenantId, subdomain },
      $setOnInsert: { createdAt: new Date() }
    },
    { upsert: true }
  )

  await registryConn.collection('clients').updateOne(
    { dbName },
    {
      $set: {
        name: displayName,
        email: contactEmail,
        dbName,
        tenantId,
<<<<<<< Updated upstream
        ...(subdomain ? { subdomain } : {}),
=======
        subdomain,
>>>>>>> Stashed changes
        ...(isNew && apiKey
          ? {
              clientKeyHash: hashTenantApiKey(apiKey),
              clientKeyPrefix: getTenantApiKeyPrefix(apiKey)
            }
          : {})
      },
      $setOnInsert: { createdAt: new Date() }
    },
    { upsert: true }
  )

  return { dbName, apiKey, tenantId, subdomain }
}
