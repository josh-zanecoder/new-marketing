export interface AdminTenantRow {
  name: string
  email: string | null
  dbName: string
  /** Registry `clients.tenantId`; null if not set. */
  tenantId: string | null
  apiKeyPrefix: string | null
  status: string
}
