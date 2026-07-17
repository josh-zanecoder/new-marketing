import { getRegistryConnection } from '@server/lib/mongoose'
import {
  findRegistryTenantByDbName,
  isTenantApiKeyAuthContext,
  resolveTenantIdForTenantAuth,
  type RegisteredTenantAuthContext
} from '@server/tenant/registry-auth'

/**
 * GCS folder segment for Custom Marketing images: registry tenant **name**
 * (not Mongo `dbName`). Falls back to API-key name, then tenantId, then dbName.
 */
export async function resolveCustomMarketingTenantFolderName(
  auth: RegisteredTenantAuthContext
): Promise<string> {
  const registry = await getRegistryConnection()
  const row = await findRegistryTenantByDbName(registry, auth.dbName)
  if (row?.tenantName?.trim()) return row.tenantName.trim()

  if (isTenantApiKeyAuthContext(auth) && auth.tenantName.trim()) {
    return auth.tenantName.trim()
  }

  const tenantId = await resolveTenantIdForTenantAuth(registry, auth)
  if (tenantId) return tenantId

  return auth.dbName
}
