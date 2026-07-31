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
   * `null` = tenant-wide (or admin) — do not filter by `user:` tag.
   * Non-null list = only events whose `user:` tag matches (empty list = no events).
   */
  userEmails: string[] | null
}

/**
 * User scope for tracking (matches recipient-list visibility):
 * - tenant-wide / Firebase / admin → `null` (no `user:` filter)
 * - API key with non-empty `contactOwnerScope` and not tenant-wide → those emails
 * - API key with empty/missing scope → `null` (treat as tenant-wide; do not blank the UI)
 */
export function resolveTrackingUserEmails(auth: unknown): string[] | null {
  if (!isTenantApiKeyAuthContext(auth)) return null
  if (auth.tenantWideContacts === true) return null
  const scope = auth.contactOwnerScope
  if (!scope?.length) return null
  const seen = new Set<string>()
  const out: string[] = []
  for (const e of scope) {
    const t = typeof e === 'string' ? e.trim().toLowerCase() : ''
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out.length ? out : null
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
    return {
      dbName,
      marketingTenantId,
      userEmails: resolveTrackingUserEmails(auth)
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
    return { dbName: row.dbName, marketingTenantId, userEmails: null }
  }

  throw createError({
    statusCode: 403,
    message: 'Tenant session required for tracking'
  })
}
