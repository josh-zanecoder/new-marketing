import type { Connection } from 'mongoose'
import { generateClientKey, hashClientKey, getClientKeyPrefix } from './clientKey'
import type { EnsureClientResult } from './clientDb.types'

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
  clientEmail: string | null
): Promise<EnsureClientResult> {
  const dbName = toClientDbName(clientName)
  const dbConn = registryConn.useDb(dbName)

  const existing = await registryConn.collection('clients').findOne({ dbName })
  const isNew = !existing

  let clientKey: string | null = null
  if (isNew) {
    clientKey = generateClientKey()
  }

  await dbConn.collection('clients').updateOne(
    { name: clientName },
    {
      $set: { email: clientEmail },
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

  return { dbName, clientKey }
}

