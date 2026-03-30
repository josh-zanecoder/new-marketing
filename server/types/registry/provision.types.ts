export interface EnsureTenantResult {
  dbName: string
  apiKey: string | null
  tenantId: string
}

export type EnsureTenantOptions = {
  /** Optional CRM base URL stored on the registry `clients` row. */
  crmAppUrl?: string | null
}
