import type { H3Event } from 'h3'
import { getRegistryConnection } from '@server/lib/mongoose'
import { ADMIN_TENANT_DB_HEADER } from '@server/constants/adminTenantProxy.constants'
import {
  findRegistryTenantByDbName,
  isAdminAuthContext,
  isRegisteredTenantAuthContext,
  isTenantApiKeyAuthContext,
  resolveTenantIdForTenantAuth
} from '@server/tenant/registry-auth'

export type TrackingTenantContext = {
  dbName: string
  marketingTenantId: string | null
  /**
   * Forced ownership scope from the session.
   * `null` = tenant-wide (or admin) — do not filter by `user:` tag unless an optional filter is applied.
   * Non-null list = only events whose `user:` tag matches (empty list = no events).
   */
  userEmails: string[] | null
  /** When true, the client may pass `?userEmail=` to narrow by Brevo `user:` tags. */
  allowUserTagFilter: boolean
}

export type TrackingUserScope = {
  ownerEmails: string[] | null
  allowUserTagFilter: boolean
}

/**
 * User scope for tracking (matches recipient-list visibility):
 * - Unrestricted (`ownerEmails: null`) → optional UI filter by Brevo `user:` tags
 *   (Firebase tenant, `tenantWideContacts`, or empty/missing owner scope)
 * - API key with non-empty `contactOwnerScope` → forced to those emails;
 *   optional UI filter only when more than one email (narrow within the team)
 * - Admin tenant proxy → unrestricted events, no optional user filter (see context resolver)
 */
export function resolveTrackingUserScope(auth: unknown): TrackingUserScope {
  if (!isTenantApiKeyAuthContext(auth)) {
    // Firebase (and other non–API-key) tenant sessions see all events — allow tag filter.
    return { ownerEmails: null, allowUserTagFilter: true }
  }
  if (auth.tenantWideContacts === true) {
    return { ownerEmails: null, allowUserTagFilter: true }
  }
  const scope = auth.contactOwnerScope
  if (!scope?.length) {
    return { ownerEmails: null, allowUserTagFilter: true }
  }
  const seen = new Set<string>()
  const out: string[] = []
  for (const e of scope) {
    const t = typeof e === 'string' ? e.trim().toLowerCase() : ''
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return {
    ownerEmails: out.length ? out : null,
    // Self + downline can narrow the report to one person in their tree.
    allowUserTagFilter: out.length > 1
  }
}

/** @deprecated Prefer `resolveTrackingUserScope`. */
export function resolveTrackingUserEmails(auth: unknown): string[] | null {
  return resolveTrackingUserScope(auth).ownerEmails
}

/**
 * Combine session ownership with an optional `userEmail` query.
 * Contact-owned sessions cannot widen past `ownerEmails`.
 * Selected user goes in `filterEmails` so `tagUsers` can still list the full ownership window.
 */
export function mergeTrackingUserEmails(
  ownerEmails: string[] | null,
  requestedUserEmail: string | null,
  allowUserTagFilter: boolean
): { ownershipEmails: string[] | null; filterEmails: string[] | null } {
  if (ownerEmails != null) {
    if (
      allowUserTagFilter &&
      requestedUserEmail &&
      ownerEmails.includes(requestedUserEmail)
    ) {
      return { ownershipEmails: ownerEmails, filterEmails: [requestedUserEmail] }
    }
    return { ownershipEmails: ownerEmails, filterEmails: null }
  }
  if (allowUserTagFilter && requestedUserEmail) {
    return { ownershipEmails: null, filterEmails: [requestedUserEmail] }
  }
  return { ownershipEmails: null, filterEmails: null }
}

export async function resolveTrackingTenantContext(
  event: H3Event
): Promise<TrackingTenantContext> {
  const auth = event.context.auth
  if (!auth || typeof auth !== 'object') {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const registryConn = await getRegistryConnection()

  if (isRegisteredTenantAuthContext(auth)) {
    const dbName = auth.dbName.trim()
    if (!dbName) {
      throw createError({ statusCode: 403, message: 'Missing tenant database context' })
    }
    const marketingTenantId = await resolveTenantIdForTenantAuth(registryConn, auth)
    const scope = resolveTrackingUserScope(auth)
    return {
      dbName,
      marketingTenantId,
      userEmails: scope.ownerEmails,
      allowUserTagFilter: scope.allowUserTagFilter
    }
  }

  if (isAdminAuthContext(auth)) {
    const adminTenantDb = (getHeader(event, ADMIN_TENANT_DB_HEADER) || '').trim()
    if (!adminTenantDb) {
      throw createError({
        statusCode: 403,
        message: 'Tenant database required for admin tracking'
      })
    }
    const row = await findRegistryTenantByDbName(registryConn, adminTenantDb)
    if (!row) {
      throw createError({
        statusCode: 403,
        message: 'Unknown tenant for admin tracking'
      })
    }
    const marketingTenantId =
      typeof row.tenantId === 'string' && row.tenantId.trim() ? row.tenantId.trim() : null
    return {
      dbName: row.dbName,
      marketingTenantId,
      userEmails: null,
      allowUserTagFilter: false
    }
  }

  throw createError({
    statusCode: 403,
    message: 'Tenant session required for tracking'
  })
}
