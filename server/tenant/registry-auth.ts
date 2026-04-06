import type { Connection } from 'mongoose'
import type { RecipientListMembershipScope } from '@server/types/tenant/recipientList.model'
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
  /** From registry `clients.crmAppUrl` when set. */
  crmAppUrl?: string
  /** Optional forwarded operator id (`x-tenant-user-id` or legacy `x-crm-user-id`). */
  tenantUserId?: string
  tenantUserEmail?: string
  tenantUserName?: string
  /** From handoff session or forwarded headers. */
  tenantUserFirstName?: string
  tenantUserLastName?: string
  tenantUserPhone?: string
  /** Tenant role display name for templates / UI (not Marketing `role: 'tenant'`). */
  tenantUserRole?: string
  /**
   * Handoff / headers: lowercased emails allowed for `metadata.ownerEmail` on contacts.
   * Omitted = no row-level filter (integrations / legacy session).
   */
  contactOwnerScope?: string[]
  /** User may see all contacts for the tenant (no owner filter). */
  tenantWideContacts?: true
}

/** Firebase session for a tenant or client user (registry row resolved). */
export type FirebaseTenantAuthContext = {
  uid: string
  email: string
  role: typeof TENANT_ROLE | 'client'
  tenantId: string
  dbName: string
  /** From registry `clients.crmAppUrl` when set. */
  crmAppUrl?: string
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

/** For `createdBy` / `metadata.owner`: Firebase `uid` or API key `tenantUserId`. */
export function tenantUserIdFromAuth(auth: unknown): string {
  if (isFirebaseTenantAuthContext(auth)) {
    return typeof auth.uid === 'string' ? auth.uid.trim() : ''
  }
  if (isTenantApiKeyAuthContext(auth)) {
    return typeof auth.tenantUserId === 'string' ? auth.tenantUserId.trim() : ''
  }
  return ''
}

/** Lowercased email for `metadata.ownerEmail` (matches `contactOwnerScope` / contact rows). */
export function tenantUserEmailFromAuth(auth: unknown): string {
  if (isFirebaseTenantAuthContext(auth)) {
    return typeof auth.email === 'string' ? auth.email.trim().toLowerCase() : ''
  }
  if (isTenantApiKeyAuthContext(auth)) {
    return typeof auth.tenantUserEmail === 'string'
      ? auth.tenantUserEmail.trim().toLowerCase()
      : ''
  }
  return ''
}

/**
 * For `createdBy` / `updatedBy`: forwarded user id (API key / Firebase uid) when present,
 * otherwise tenant user email (browser handoff JWT has email, not id).
 */
export function tenantCreatedByFromAuth(auth: unknown): string {
  const id = tenantUserIdFromAuth(auth)
  if (id) return id
  return tenantUserEmailFromAuth(auth)
}

/** Campaigns: `metadata.owner` + `metadata.ownerEmail` and `createdBy` when known. */
export function tenantOwnershipFieldsFromAuth(auth: unknown): {
  createdBy?: string
  metadata?: { owner?: string; ownerEmail?: string }
} {
  const owner = tenantUserIdFromAuth(auth)
  const ownerEmail = tenantUserEmailFromAuth(auth)
  const createdBy = tenantCreatedByFromAuth(auth)
  if (!owner && !ownerEmail && !createdBy) return {}
  const metadata: { owner?: string; ownerEmail?: string } = {}
  if (owner) metadata.owner = owner
  if (ownerEmail) metadata.ownerEmail = ownerEmail
  return {
    ...(createdBy ? { createdBy } : {}),
    ...(Object.keys(metadata).length ? { metadata } : {})
  }
}

/** Recipient lists: `metadata` only has `ownerEmail`; `createdBy` uses id or email. */
export function recipientListOwnershipFromAuth(auth: unknown): {
  createdBy?: string
  metadata?: { ownerEmail?: string }
} {
  const createdBy = tenantCreatedByFromAuth(auth)
  const ownerEmail = tenantUserEmailFromAuth(auth)
  if (!createdBy && !ownerEmail) return {}
  return {
    ...(createdBy ? { createdBy } : {}),
    ...(ownerEmail ? { metadata: { ownerEmail } } : {})
  }
}

/**
 * Persisted on recipient lists: matches contact visibility — tenant-wide vs owner-email scope.
 * Firebase / no API-key row filter → `tenant`; API key with `contactOwnerScope` → `owner_emails`.
 */
export function recipientListMembershipScopeFromAuth(
  auth: unknown
): RecipientListMembershipScope {
  if (!isTenantApiKeyAuthContext(auth)) return 'tenant'
  if (auth.tenantWideContacts === true) return 'tenant'
  if (auth.contactOwnerScope?.length) return 'owner_emails'
  return 'tenant'
}

/** Persisted on `owner_emails` lists so sync/rebuild match `contactOwnerScope` without session. */
export function recipientListMembershipOwnerEmailsFromAuth(auth: unknown): string[] {
  if (isTenantApiKeyAuthContext(auth) && auth.contactOwnerScope?.length) {
    const seen = new Set<string>()
    const out: string[] = []
    for (const e of auth.contactOwnerScope) {
      const t = typeof e === 'string' ? e.trim().toLowerCase() : ''
      if (!t || seen.has(t)) continue
      seen.add(t)
      out.push(t)
    }
    return out
  }
  const em = tenantUserEmailFromAuth(auth)
  return em ? [em] : []
}

export function isFirebaseTenantAuthContext(
  value: unknown
): value is FirebaseTenantAuthContext {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  if (v.type === 'tenantApiKey') return false
  const roleOk = v.role === TENANT_ROLE || v.role === 'client'
  if (!roleOk) return false
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
): Promise<{
  tenantName: string
  dbName: string
  tenantId: string
  crmAppUrl?: string
} | null> {
  const doc = await registryConn
    .collection('clients')
    .findOne({ tenantId })
    .then(
      (d) =>
        d as {
          name?: string
          dbName?: string
          tenantId?: string
          crmAppUrl?: string
        } | null
    )
  if (!doc?.name || !doc?.dbName) return null
  const id =
    typeof doc.tenantId === 'string' && doc.tenantId ? doc.tenantId : tenantId
  const out: {
    tenantName: string
    dbName: string
    tenantId: string
    crmAppUrl?: string
  } = { tenantName: doc.name, dbName: doc.dbName, tenantId: id }
  const crm = typeof doc.crmAppUrl === 'string' ? doc.crmAppUrl.trim() : ''
  if (crm) out.crmAppUrl = crm.replace(/\/+$/, '')
  return out
}

/** Registry tenant row by marketing DB name (browser session JWT `sub`). */
export async function findRegistryTenantByDbName(
  registryConn: Connection,
  dbName: string
): Promise<{
  tenantName: string
  dbName: string
  tenantId?: string
  crmAppUrl?: string
  /** SHA256 hex of `nmk_` — used to sign browser session cookie. */
  clientKeyHash: string | null
} | null> {
  const key = dbName.trim()
  if (!key) return null
  const doc = await registryConn
    .collection('clients')
    .findOne({ dbName: key })
    .then(
      (d) =>
        d as {
          name?: string
          dbName?: string
          tenantId?: string
          crmAppUrl?: string
          clientKeyHash?: string
          apiKeyHash?: string
        } | null
    )
  if (!doc?.name || !doc?.dbName) return null
  const hashRaw =
    typeof doc.clientKeyHash === 'string' && doc.clientKeyHash
      ? doc.clientKeyHash
      : typeof doc.apiKeyHash === 'string' && doc.apiKeyHash
        ? doc.apiKeyHash
        : null
  const out: {
    tenantName: string
    dbName: string
    tenantId?: string
    crmAppUrl?: string
    clientKeyHash: string | null
  } = {
    tenantName: doc.name,
    dbName: doc.dbName,
    clientKeyHash: hashRaw
  }
  if (typeof doc.tenantId === 'string' && doc.tenantId) {
    out.tenantId = doc.tenantId
  }
  const crm = typeof doc.crmAppUrl === 'string' ? doc.crmAppUrl.trim() : ''
  if (crm) out.crmAppUrl = crm.replace(/\/+$/, '')
  return out
}

export async function findRegistryTenantByApiKey(
  registryConn: Connection,
  apiKey: string
): Promise<{
  tenantName: string
  dbName: string
  tenantId?: string
  crmAppUrl?: string
} | null> {
  const hash = hashTenantApiKey(apiKey)
  const doc = await registryConn
    .collection('clients')
    .findOne({ $or: [{ clientKeyHash: hash }, { apiKeyHash: hash }] })
    .then(
      (d) =>
        d as {
          name?: string
          dbName?: string
          tenantId?: string
          crmAppUrl?: string
        } | null
    )
  if (!doc?.name || !doc?.dbName) return null
  const out: {
    tenantName: string
    dbName: string
    tenantId?: string
    crmAppUrl?: string
  } = {
    tenantName: doc.name,
    dbName: doc.dbName
  }
  if (typeof doc.tenantId === 'string' && doc.tenantId) {
    out.tenantId = doc.tenantId
  }
  const crm = typeof doc.crmAppUrl === 'string' ? doc.crmAppUrl.trim() : ''
  if (crm) out.crmAppUrl = crm.replace(/\/+$/, '')
  return out
}
