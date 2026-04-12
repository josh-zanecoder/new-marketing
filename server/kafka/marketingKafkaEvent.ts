/** Outbound event envelope for Google Cloud Managed Service for Apache Kafka consumers. */
export interface MarketingKafkaEnvelope {
  eventType: string
  occurredAt: string
  tenantDbName: string
  tenantId?: string
  payload: Record<string, unknown>
}
