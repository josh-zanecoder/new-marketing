/** Raw registry row (`clients` collection). Field names match stored documents. */
export interface RegistryTenantDoc {
  _id?: unknown
  name?: unknown
  email?: unknown
  dbName?: unknown
  subdomain?: unknown
  tenantId?: unknown
  subdomain?: unknown
  firebaseTenantId?: unknown
  clientKeyPrefix?: unknown
  /** Legacy field on some registry docs */
  apiKeyPrefix?: unknown
  createdAt?: unknown
}

/** Admin list row for a registered tenant (registry). */
export interface TenantAdminRow {
  name: string
  email: string | null
  dbName: string
  subdomain: string | null
  tenantId: string | null
  subdomain: string | null
  firebaseTenantId: string | null
  /** Masked prefix for the tenant API key (from `clientKeyPrefix` in Mongo). */
  apiKeyPrefix: string | null
  createdAt: string
}
