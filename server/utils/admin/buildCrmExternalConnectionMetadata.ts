import type { CrmExternalConnectionMetadata } from '../../../shared/types/crmExternalConnection'
import { resolveCrmIntegrationConfig } from './resolveCrmIntegrationConfig'

type BuildCrmExternalConnectionInput = {
  dbName: string
  tenantId: string
  apiKey: string
  kafkaTopic: string
}

export function buildCrmExternalConnectionMetadata(
  input: BuildCrmExternalConnectionInput
): CrmExternalConnectionMetadata {
  const integration = resolveCrmIntegrationConfig()

  return {
    DB_NAME: input.dbName,
    TENANT_ID: input.tenantId,
    KAFKA_MODE: 'bridge',
    KAFKA_BRIDGE_URL: integration.kafkaBridgeUrl,
    MARKETING_API_KEY: input.apiKey,
    MARKETING_APP_URL: integration.marketingAppUrl,
    KAFKA_BRIDGE_TOKEN: integration.kafkaBridgeToken,
    MARKETING_HANDOFF_JWT_AUD: integration.marketingHandoffAud,
    MARKETING_HANDOFF_JWT_ISS: integration.marketingHandoffIss,
    KAFKA_TOPIC_MARKETING_EVENTS: input.kafkaTopic
  }
}
