import type { Connection } from 'mongoose'
import { hashTenantApiKey } from './api-key'

export const ADMIN_ROLE = 'admin' as const
export const TENANT_ROLE = 'tenant' as const

export type RoleAuthContext = { role: typeof ADMIN_ROLE }

export type TenantApiKeyAuthContext = {
  type: 'tenantApiKey'
  role: typeof TENANT_ROLE
  tenantName: string
  dbName: string
  tenantId?: string
  subdomain?: string
}

/** Firebase session for a tenant user (registry row resolved). */
export type FirebaseTenantAuthContext = {
  uid: string
  email: string
  role: typeof TENANT_ROLE
  tenantId: string
  dbName: string
  subdomain?: string
}

export function isAdminAuthContext(value: unknown): value is RoleAuthContext {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return v.role === ADMIN_ROLE
}

export function isTenantApiKeyAuthContext(
  value: unknown
): value is TenantApiKeyAuthContext {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    v.type === 'tenantApiKey' &&
    v.role === TENANT_ROLE &&
    typeof v.dbName === 'string' &&
    v.dbName.length > 0
  )
}

/** Firebase tenant session or tenant API key — has a resolved `dbName`. */
export type RegisteredTenantAuthContext =
  | FirebaseTenantAuthContext
  | TenantApiKeyAuthContext

export function isRegisteredTenantAuthContext(
  value: unknown
): value is RegisteredTenantAuthContext {
  return isFirebaseTenantAuthContext(value) || isTenantApiKeyAuthContext(value)
}

export function isFirebaseTenantAuthContext(
  value: unknown
): value is FirebaseTenantAuthContext {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  if (v.role !== TENANT_ROLE || v.type === 'tenantApiKey') return false
  return (
    typeof v.uid === 'string' &&
    typeof v.tenantId === 'string' &&
    v.tenantId.length > 0 &&
    typeof v.dbName === 'string' &&
    v.dbName.length > 0
  )
}

/**
 * Resolves registry `tenantId` for tenant API routes (Firebase session or API key).
 * API-key sessions may omit `tenantId` on the auth object; then we read `clients.tenantId` by `dbName`.
 */
export async function resolveTenantIdForTenantAuth(
  registryConn: Connection,
  auth: RegisteredTenantAuthContext
): Promise<string | null> {
  if (isFirebaseTenantAuthContext(auth)) {
    return auth.tenantId.trim()
  }
  if (isTenantApiKeyAuthContext(auth)) {
    if (typeof auth.tenantId === 'string' && auth.tenantId.trim()) {
      return auth.tenantId.trim()
    }
  }
  const doc = await registryConn
    .collection('clients')
    .findOne({ dbName: auth.dbName })
    .then((d) => d as { tenantId?: string } | null)
  const tid =
    doc && typeof doc.tenantId === 'string' ? doc.tenantId.trim() : ''
  return tid || null
}

export async function findRegistryTenantByTenantId(
  registryConn: Connection,
  tenantId: string
): Promise<{ tenantName: string; dbName: string; tenantId: string; subdomain?: string; firebaseTenantId?: string } | null> {
  const doc = await registryConn
    .collection('clients')
    .findOne({ tenantId })
    .then(
      (d) =>
        d as { name?: string; dbName?: string; tenantId?: string; subdomain?: string; firebaseTenantId?: string } | null
    )
  if (!doc?.name || !doc?.dbName) return null
  const id =
    typeof doc.tenantId === 'string' && doc.tenantId ? doc.tenantId : tenantId
  const out: { tenantName: string; dbName: string; tenantId: string; subdomain?: string; firebaseTenantId?: string } = {
    tenantName: doc.name,
    dbName: doc.dbName,
    tenantId: id
  }
  if (typeof doc.subdomain === 'string' && doc.subdomain) out.subdomain = doc.subdomain
  if (typeof doc.firebaseTenantId === 'string' && doc.firebaseTenantId) out.firebaseTenantId = doc.firebaseTenantId
  return out
}

export async function findRegistryTenantByApiKey(
  registryConn: Connection,
  apiKey: string
): Promise<{ tenantName: string; dbName: string; tenantId?: string; subdomain?: string; firebaseTenantId?: string } | null> {
  const hash = hashTenantApiKey(apiKey)
  const doc = await registryConn
    .collection('clients')
    .findOne({ $or: [{ clientKeyHash: hash }, { apiKeyHash: hash }] })
    .then(
      (d) => d as { name?: string; dbName?: string; tenantId?: string; subdomain?: string; firebaseTenantId?: string } | null
    )
  if (!doc?.name || !doc?.dbName) return null
  const out: { tenantName: string; dbName: string; tenantId?: string; subdomain?: string; firebaseTenantId?: string } = {
    tenantName: doc.name,
    dbName: doc.dbName
  }
  if (typeof doc.tenantId === 'string' && doc.tenantId) {
    out.tenantId = doc.tenantId
  }
  if (typeof doc.subdomain === 'string' && doc.subdomain) out.subdomain = doc.subdomain
  if (typeof doc.firebaseTenantId === 'string' && doc.firebaseTenantId) out.firebaseTenantId = doc.firebaseTenantId
  return out
}

export async function findRegistryTenantBySubdomain(
  registryConn: Connection,
  subdomain: string
): Promise<{ tenantName: string; dbName: string; tenantId?: string; subdomain: string; firebaseTenantId?: string } | null> {
  const normalized = subdomain.trim().toLowerCase()
  if (!normalized) return null
  const doc = await registryConn
    .collection('clients')
    .findOne({ subdomain: normalized })
    .then(
      (d) => d as { name?: string; dbName?: string; tenantId?: string; subdomain?: string; firebaseTenantId?: string } | null
    )
  if (!doc?.name || !doc?.dbName || !doc?.subdomain) return null
  const out: { tenantName: string; dbName: string; tenantId?: string; subdomain: string; firebaseTenantId?: string } = {
    tenantName: doc.name,
    dbName: doc.dbName,
    subdomain: doc.subdomain
  }
  if (typeof doc.tenantId === 'string' && doc.tenantId) out.tenantId = doc.tenantId
  if (typeof doc.firebaseTenantId === 'string' && doc.firebaseTenantId) out.firebaseTenantId = doc.firebaseTenantId
  return out
}

export type RegistryTenantRow = {
  tenantName: string
  dbName: string
  tenantId: string
  subdomain: string
}

export async function findRegistryTenantBySubdomain(
  registryConn: Connection,
  subdomain: string
): Promise<RegistryTenantRow | null> {
  const normalized = subdomain.trim().toLowerCase()
  if (!normalized) return null
  const doc = await registryConn
    .collection('clients')
    .findOne({ subdomain: normalized })
    .then(
      (d) =>
        d as { name?: string; dbName?: string; tenantId?: string; subdomain?: string } | null
    )
  if (!doc?.name || !doc?.dbName || !doc?.subdomain) return null
  const tenantId = typeof doc.tenantId === 'string' && doc.tenantId ? doc.tenantId : ''
  if (!tenantId) return null
  return { tenantName: doc.name, dbName: doc.dbName, tenantId, subdomain: doc.subdomain }
}
