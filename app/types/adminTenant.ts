export interface AdminTenantRow {
  name: string
  email: string | null
  dbName: string
  /** Registry `clients.tenantId`; null if not set. */
  tenantId: string | null
  apiKeyPrefix: string | null
  /** Registry `crmAppUrl` for handoff “Back to CRM”. */
  crmAppUrl: string | null
  /**
   * Full Kafka topic for outbound marketing events, or `null` for default `{prefix}.{tenant}`.
   */
  kafkaOutboundTopic: string | null
  status: string
}
