import type { Connection } from 'mongoose'
import { hashClientKey } from './clientKey'

export const ADMIN_ROLE = 'admin' as const

export type RoleAuthContext = { role: 'admin' }

export type ClientKeyAuthContext = {
  type: 'clientKey'
  role: 'client'
  clientName: string
  dbName: string
}

export function isAdminAuthContext(value: unknown): value is RoleAuthContext {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return v.role === ADMIN_ROLE
}

export function isClientKeyAuthContext(
  value: unknown
): value is ClientKeyAuthContext {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return v.type === 'clientKey' && v.role === 'client'
}

export async function findClientByClientKey(
  registryConn: Connection,
  clientKey: string
): Promise<{ clientName: string; dbName: string } | null> {
  const hash = hashClientKey(clientKey)
  const doc = await registryConn
    .collection('clients')
    .findOne({ $or: [{ clientKeyHash: hash }, { apiKeyHash: hash }] })
    .then((d) => d as { name?: string; dbName?: string } | null)
  if (!doc?.name || !doc?.dbName) return null
  return { clientName: doc.name, dbName: doc.dbName }
}

