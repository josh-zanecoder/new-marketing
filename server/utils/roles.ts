import type { Connection } from 'mongoose'
import { hashClientKey } from './clientKey'

export const ADMIN_ROLE = 'admin' as const

export type RoleAuthContext = { role: 'admin' }

export type ClientKeyAuthContext = {
  type: 'clientKey'
  role: 'client'
  clientName: string
  dbName: string
  tenantId?: string
}

/** Firebase session for a `client` user (has resolved tenant). */
export type FirebaseClientAuthContext = {
  uid: string
  email: string
  role: 'client'
  tenantId: string
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
  return (
    v.type === 'clientKey' &&
    v.role === 'client' &&
    typeof v.dbName === 'string' &&
    v.dbName.length > 0
  )
}

/** Firebase client session or client API key — has a resolved tenant `dbName`. */
export type TenantClientAuthContext =
  | FirebaseClientAuthContext
  | ClientKeyAuthContext

export function isTenantClientAuthContext(
  value: unknown
): value is TenantClientAuthContext {
  return isFirebaseClientAuthContext(value) || isClientKeyAuthContext(value)
}

export function isFirebaseClientAuthContext(
  value: unknown
): value is FirebaseClientAuthContext {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  if (v.role !== 'client' || v.type === 'clientKey') return false
  return (
    typeof v.uid === 'string' &&
    typeof v.tenantId === 'string' &&
    v.tenantId.length > 0 &&
    typeof v.dbName === 'string' &&
    v.dbName.length > 0
  )
}

export async function findClientByTenantId(
  registryConn: Connection,
  tenantId: string
): Promise<{ clientName: string; dbName: string; tenantId: string } | null> {
  const doc = await registryConn
    .collection('clients')
    .findOne({ tenantId })
    .then(
      (d) =>
        d as { name?: string; dbName?: string; tenantId?: string } | null
    )
  if (!doc?.name || !doc?.dbName) return null
  const id =
    typeof doc.tenantId === 'string' && doc.tenantId ? doc.tenantId : tenantId
  return { clientName: doc.name, dbName: doc.dbName, tenantId: id }
}

export async function findClientByClientKey(
  registryConn: Connection,
  clientKey: string
): Promise<{ clientName: string; dbName: string; tenantId?: string } | null> {
  const hash = hashClientKey(clientKey)
  const doc = await registryConn
    .collection('clients')
    .findOne({ $or: [{ clientKeyHash: hash }, { apiKeyHash: hash }] })
    .then(
      (d) => d as { name?: string; dbName?: string; tenantId?: string } | null
    )
  if (!doc?.name || !doc?.dbName) return null
  const out: { clientName: string; dbName: string; tenantId?: string } = {
    clientName: doc.name,
    dbName: doc.dbName
  }
  if (typeof doc.tenantId === 'string' && doc.tenantId) {
    out.tenantId = doc.tenantId
  }
  return out
}

