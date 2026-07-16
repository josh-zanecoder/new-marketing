type CrmIntegrationConfig = {
  marketingAppUrl: string
  kafkaBridgeUrl: string
  kafkaBridgeToken: string
  marketingHandoffIss: string
  marketingHandoffAud: string
}

const DEVELOP_DEFAULTS = {
  marketingAppUrl: 'https://marketing-test-980800581325.us-west1.run.app/',
  kafkaBridgeUrl: 'https://marketing-kafka-producer-bridge-980800581325.us-west1.run.app'
}

const PRODUCTION_DEFAULTS = {
  marketingAppUrl: 'https://marketing-production-980800581325.us-west1.run.app/',
  kafkaBridgeUrl: 'https://marketing-kafka-producer-bridge-production-980800581325.us-west1.run.app'
}

function normalizeAppUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`
}

function normalizeBridgeUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '')
}

function resolveDeployEnvDefaults(deployEnv: string): { marketingAppUrl: string; kafkaBridgeUrl: string } {
  if (deployEnv === 'production') return PRODUCTION_DEFAULTS
  return DEVELOP_DEFAULTS
}

/** CRM external-connection JSON — read Cloud Run / .env at request time. */
export function resolveCrmIntegrationConfig(): CrmIntegrationConfig {
  const deployEnv = String(process.env.MARKETING_DEPLOY_ENV ?? 'develop').trim().toLowerCase()
  const defaults = resolveDeployEnvDefaults(deployEnv)

  return {
    marketingAppUrl: normalizeAppUrl(
      process.env.MARKETING_APP_URL || defaults.marketingAppUrl
    ),
    kafkaBridgeUrl: normalizeBridgeUrl(
      process.env.KAFKA_BRIDGE_URL || defaults.kafkaBridgeUrl
    ),
    kafkaBridgeToken: String(process.env.KAFKA_BRIDGE_TOKEN ?? '').trim(),
    marketingHandoffIss:
      String(process.env.MARKETING_HANDOFF_JWT_ISS ?? '').trim() || 'marketing-tenant',
    marketingHandoffAud:
      String(process.env.MARKETING_HANDOFF_JWT_AUD ?? '').trim() || 'new-marketing'
  }
}
