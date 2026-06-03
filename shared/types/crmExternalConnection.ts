export type CrmExternalConnectionMetadata = {
  DB_NAME: string
  TENANT_ID: string
  KAFKA_MODE: 'bridge'
  KAFKA_BRIDGE_URL: string
  MARKETING_API_KEY: string
  MARKETING_APP_URL: string
  KAFKA_BRIDGE_TOKEN: string
  MARKETING_HANDOFF_JWT_AUD: string
  MARKETING_HANDOFF_JWT_ISS: string
  KAFKA_TOPIC_MARKETING_EVENTS: string
}
