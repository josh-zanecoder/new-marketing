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

export function resolveCrmIntegrationConfig(): CrmIntegrationConfig {
  const config = useRuntimeConfig()
  const deployEnv = String(config.marketingDeployEnv ?? 'develop').trim().toLowerCase()
  const defaults = resolveDeployEnvDefaults(deployEnv)

  const marketingAppUrl = normalizeAppUrl(
    String(config.marketingAppUrl || defaults.marketingAppUrl)
  )
  const kafkaBridgeUrl = normalizeBridgeUrl(
    String(config.kafkaBridgeUrl || defaults.kafkaBridgeUrl)
  )
  const kafkaBridgeToken = String(config.kafkaBridgeToken ?? '').trim()

  return {
    marketingAppUrl,
    kafkaBridgeUrl,
    kafkaBridgeToken,
    marketingHandoffIss: String(config.marketingHandoffIss ?? '').trim() || 'marketing-tenant',
    marketingHandoffAud: String(config.marketingHandoffAud ?? '').trim() || 'new-marketing'
  }
}
