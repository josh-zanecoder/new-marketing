export interface AdminTenantRow {
  name: string
  email: string | null
  dbName: string
  apiKeyPrefix: string | null
  status: string
}
