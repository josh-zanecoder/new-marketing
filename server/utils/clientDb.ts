import { randomUUID } from 'node:crypto'
import type { Connection } from 'mongoose'
import { generateClientKey, hashClientKey, getClientKeyPrefix } from './clientKey'
import type { EnsureClientResult } from '../types/clients/clientDb.types'

export function toClientDbName(clientName: string): string {
  const base = clientName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')

  if (!base) {
    throw createError({ statusCode: 400, message: 'clientName must be a non-empty string' })
  }

  const maxBaseLen = 61
  const truncated = base.slice(0, maxBaseLen)

  return `${truncated}_db`
}

export type { EnsureClientResult }

export async function ensureClientDatabaseInitialized(
  registryConn: Connection,
  clientName: string,
  clientEmail: string | null,
  tenantIdFromBody: string | null = null
): Promise<EnsureClientResult> {
  const dbName = toClientDbName(clientName)
  const dbConn = registryConn.useDb(dbName)

  const existing = (await registryConn.collection('clients').findOne({ dbName })) as {
    tenantId?: string
  } | null
  const isNew = !existing

  let clientKey: string | null = null
  if (isNew) {
    clientKey = generateClientKey()
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
    { name: clientName },
    {
      $set: { email: clientEmail, tenantId },
      $setOnInsert: { createdAt: new Date() }
    },
    { upsert: true }
  )

  await registryConn.collection('clients').updateOne(
    { dbName },
    {
      $set: {
        name: clientName,
        email: clientEmail,
        dbName,
        tenantId,
        ...(isNew && clientKey
          ? {
              clientKeyHash: hashClientKey(clientKey),
              clientKeyPrefix: getClientKeyPrefix(clientKey)
            }
          : {})
      },
      $setOnInsert: { createdAt: new Date() }
    },
    { upsert: true }
  )

  return { dbName, clientKey, tenantId }
}

