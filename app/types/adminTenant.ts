export interface AdminTenantRow {
  name: string
  email: string | null
  dbName: string
  subdomain: string | null
  apiKeyPrefix: string | null
  status: string
}
