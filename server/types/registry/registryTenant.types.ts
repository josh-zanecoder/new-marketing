/** Raw registry row (`clients` collection). Field names match stored documents. */
export interface RegistryTenantDoc {
  _id?: unknown
  name?: unknown
  email?: unknown
  dbName?: unknown
  tenantId?: unknown
  clientKeyPrefix?: unknown
  /** Legacy field on some registry docs */
  apiKeyPrefix?: unknown
  createdAt?: unknown
  /** CRM web app base URL for “Back to CRM” after tenant handoff. */
  crmAppUrl?: unknown
}

/** Admin list row for a registered tenant (registry). */
export interface TenantAdminRow {
  name: string
  email: string | null
  dbName: string
  tenantId: string | null
  /** Masked prefix for the tenant API key (from `clientKeyPrefix` in Mongo). */
  apiKeyPrefix: string | null
  createdAt: string
  /** Per-tenant CRM origin, e.g. https://app.client.com */
  crmAppUrl: string | null
}
