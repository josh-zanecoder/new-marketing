import { randomUUID } from 'node:crypto'
import type { Connection } from 'mongoose'
import {
  generateTenantApiKey,
  hashTenantApiKey,
  getTenantApiKeyPrefix
} from './api-key'
import type { EnsureTenantResult } from '../types/registry/provision.types'

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
  tenantIdFromBody: string | null = null
): Promise<EnsureTenantResult> {
  const dbName = toTenantDbName(displayName)
  const dbConn = registryConn.useDb(dbName)

  const existing = (await registryConn.collection('clients').findOne({ dbName })) as {
    tenantId?: string
  } | null
  const isNew = !existing

  let apiKey: string | null = null
  if (isNew) {
    apiKey = generateTenantApiKey()
  }

  const trimmedTenant = tenantIdFromBody?.trim() || null
  let tenantId =
    typeof existing?.tenantId === 'string' && existing.tenantId
      ? existing.tenantId
      : trimmedTenant || randomUUID()

  if (!existing?.tenantId && trimmedTenant) {
    const dup = await registryConn.collection('clients').findOne({
      tenantId,
      dbName: { $ne: dbName }
    })
    if (dup) {
      throw createError({ statusCode: 409, message: 'tenantId is already in use' })
    }
  }

  await dbConn.collection('clients').updateOne(
    { name: displayName },
    {
      $set: { email: contactEmail, tenantId },
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

  return { dbName, apiKey, tenantId }
}
