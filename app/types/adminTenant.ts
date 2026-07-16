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
  /** Default campaign From email; null uses global fallback. */
  defaultCampaignSenderEmail: string | null
  /** Default campaign From name; null uses global fallback. */
  defaultCampaignSenderName: string | null
  /** True when a custom Brevo API key is stored for this tenant. */
  brevoApiKeyConfigured: boolean
  /** Masked prefix of the custom Brevo key (never the full secret). */
  brevoApiKeyPrefix: string | null
  status: string
}
