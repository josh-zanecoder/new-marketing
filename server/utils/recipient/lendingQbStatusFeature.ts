import type { Connection } from 'mongoose'
import { getRegistryConnection } from '@server/lib/mongoose'
import { parseAllowTenantLendingQbStatus } from '~~/shared/allowTenantLendingQbStatus'

/**
 * Read the per-tenant LendingQB status toggle from the registry.
 *
 * Audience evaluation runs on hot paths (every contact event re-checks list membership), so the
 * value is cached briefly per tenant DB. The superadmin PATCH invalidates the local cache; other
 * instances pick the change up within the TTL.
 */
const CACHE_TTL_MS = 30_000

const cache = new Map<string, { value: boolean; expiresAt: number }>()

export function invalidateLendingQbStatusFeatureCache(dbName?: string): void {
  if (dbName) cache.delete(dbName)
  else cache.clear()
}

export async function isLendingQbStatusEnabledForDb(dbName: string): Promise<boolean> {
  const name = String(dbName ?? '').trim()
  if (!name) return false
  const now = Date.now()
  const hit = cache.get(name)
  if (hit && hit.expiresAt > now) return hit.value
  try {
    const registry = await getRegistryConnection()
    const doc = await registry
      .collection('clients')
      .findOne({ dbName: name }, { projection: { allowTenantLendingQbStatus: 1 } })
    const value = parseAllowTenantLendingQbStatus(doc?.allowTenantLendingQbStatus)
    cache.set(name, { value, expiresAt: now + CACHE_TTL_MS })
    return value
  } catch {
    // Fail closed: keep the existing keyword behavior if the registry is unreachable.
    return false
  }
}

/** Tenant connections are opened with `useDb(dbName)`, so the connection name is the DB name. */
export async function isLendingQbStatusEnabledForConnection(
  tenantConn: Pick<Connection, 'name'>
): Promise<boolean> {
  return isLendingQbStatusEnabledForDb(tenantConn.name)
}
