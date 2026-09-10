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
  /**
   * When set, outbound marketing Kafka events use this **full** topic name instead of
   * `{KAFKA_TOPIC_MARKETING_EVENTS}.{tenantSuffix}`.
   */
  kafkaOutboundTopic?: unknown
  /** Default From name for new campaigns when the user leaves sender name empty. */
  defaultCampaignSenderName?: unknown
  /** Default From email for new campaigns when the user leaves sender email empty. */
  defaultCampaignSenderEmail?: unknown
  /** Optional per-tenant Brevo transactional API key; empty/missing → env `BREVO_API_KEY`. */
  brevoApiKey?: unknown
  /**
   * Optional per-tenant Brevo transactional webhook secret; empty/missing → env
   * `BREVO_WEBHOOK_SECRET`.
   */
  brevoWebhookSecret?: unknown
  /** Outbound email provider for campaigns / test sends. Default Brevo. */
  emailProvider?: unknown
  /** zcMail API base URL (non-secret). */
  zcMailBaseUrl?: unknown
  /** zcMail tenant slug sent as body `tenant` (SES TenantName). */
  zcMailTenant?: unknown
  /** When true, zcMail archives outbound mail. Default true. */
  zcMailArchive?: unknown
  /** Per-tenant zcMail API key. */
  zcMailApiKey?: unknown
  /**
   * Optional per-tenant zcMail webhook HMAC secret; empty/missing → env
   * `ZC_MAIL_WEBHOOK_SECRET`.
   */
  zcMailWebhookSecret?: unknown
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
  /**
   * Full Kafka topic for this tenant’s outbound marketing events, or `null` to use the default
   * `{prefix}.{sanitized tenant name}` pattern.
   */
  kafkaOutboundTopic: string | null
  /** Per-tenant default campaign From name; `null` uses shared fallback. */
  defaultCampaignSenderName: string | null
  /** Per-tenant default campaign From email; `null` uses shared fallback. */
  defaultCampaignSenderEmail: string | null
  /** True when a custom Brevo API key is stored for this tenant. */
  brevoApiKeyConfigured: boolean
  /** Masked prefix of the custom Brevo key (never the full secret). */
  brevoApiKeyPrefix: string | null
  /** True when a custom Brevo webhook secret is stored for this tenant. */
  brevoWebhookSecretConfigured: boolean
  /** Masked prefix of the custom Brevo webhook secret (never the full secret). */
  brevoWebhookSecretPrefix: string | null
  /** Outbound email provider. */
  emailProvider: 'BREVO' | 'ZC_MAIL'
  zcMailBaseUrl: string | null
  zcMailTenant: string | null
  zcMailArchive: boolean
  zcMailApiKeyConfigured: boolean
  zcMailApiKeyPrefix: string | null
  /** True when a custom zcMail webhook HMAC secret is stored for this tenant. */
  zcMailWebhookSecretConfigured: boolean
  /** Masked prefix of the custom zcMail webhook secret (never the full secret). */
  zcMailWebhookSecretPrefix: string | null
}
