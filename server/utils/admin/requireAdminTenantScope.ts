import type { H3Event } from 'h3'
import { getRegistryConnection } from '@server/lib/mongoose'
import { findRegistryTenantByTenantId, isAdminAuthContext } from '@server/tenant/registry-auth'

export type AdminTenantScope = {
  tenantId: string
  dbName: string
  tenantName: string
}

export function parseAdminTenantIdParam(raw: string | undefined | null): string {
  return decodeURIComponent(String(raw ?? '')).trim()
}

/** Resolve registry tenant row for admin routes keyed by CRM/marketing `tenantId`. */
export async function requireAdminTenantScope(
  event: H3Event,
  tenantIdRaw: string | undefined | null
): Promise<AdminTenantScope> {
  const auth = event.context.auth as unknown
  if (!isAdminAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const tenantId = parseAdminTenantIdParam(tenantIdRaw)
  if (!tenantId) {
    throw createError({ statusCode: 400, message: 'Missing tenant id' })
  }

  const registry = await getRegistryConnection()
  const row = await findRegistryTenantByTenantId(registry, tenantId)
  if (!row) {
    throw createError({ statusCode: 404, message: 'Tenant not found' })
  }

  return {
    tenantId: row.tenantId,
    dbName: row.dbName,
    tenantName: row.tenantName
  }
}
