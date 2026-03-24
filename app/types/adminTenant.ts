export interface AdminTenantRow {
  name: string
  email: string | null
  dbName: string
  subdomain: string | null
  /** Registry `clients.tenantId`; null if not set. */
  tenantId: string | null
  subdomain: string | null
  firebaseTenantId: string | null
  apiKeyPrefix: string | null
  status: string
}
