import {
  parseTenantEmailProvider,
  TENANT_EMAIL_PROVIDER_BREVO,
  TENANT_EMAIL_PROVIDER_ZC_MAIL,
  type TenantEmailProvider
} from '@server/constants/emailProvider'
import { ZC_MAIL_DEFAULT_BASE_URL } from '@server/constants/zcMailWebhook'
import { getRegistryConnection } from '@server/lib/mongoose'
import type { RegistryTenantDoc } from '@server/types/registry/registryTenant.types'

export type ResolvedTenantEmailSendConfig =
  | { provider: typeof TENANT_EMAIL_PROVIDER_BREVO }
  | {
      provider: typeof TENANT_EMAIL_PROVIDER_ZC_MAIL
      apiKey: string
      zcMailBaseUrl: string
      zcMailTenant: string
      zcMailArchive: boolean
    }

export function parseTenantEmailSendConfig(
  doc: RegistryTenantDoc | null
): ResolvedTenantEmailSendConfig {
  const provider = parseTenantEmailProvider(doc?.emailProvider)
  if (provider !== TENANT_EMAIL_PROVIDER_ZC_MAIL) {
    return { provider: TENANT_EMAIL_PROVIDER_BREVO }
  }

  const apiKey =
    typeof doc?.zcMailApiKey === 'string' && doc.zcMailApiKey.trim()
      ? doc.zcMailApiKey.trim()
      : ''
  const zcMailTenant =
    typeof doc?.zcMailTenant === 'string' && doc.zcMailTenant.trim()
      ? doc.zcMailTenant.trim()
      : ''
  const fromDoc =
    typeof doc?.zcMailBaseUrl === 'string' && doc.zcMailBaseUrl.trim()
      ? doc.zcMailBaseUrl.trim().replace(/\/+$/, '')
      : ''
  const zcMailArchive = doc?.zcMailArchive !== false

  return {
    provider: TENANT_EMAIL_PROVIDER_ZC_MAIL,
    apiKey,
    zcMailBaseUrl: fromDoc || ZC_MAIL_DEFAULT_BASE_URL,
    zcMailTenant,
    zcMailArchive
  }
}

export type ZcMailSendConfig = Extract<
  ResolvedTenantEmailSendConfig,
  { provider: typeof TENANT_EMAIL_PROVIDER_ZC_MAIL }
>

export function requireZcMailSendConfig(
  config: ResolvedTenantEmailSendConfig
): ZcMailSendConfig {
  if (config.provider !== TENANT_EMAIL_PROVIDER_ZC_MAIL) {
    throw new Error('Expected ZC_MAIL email provider')
  }
  if (!config.apiKey.trim()) {
    throw new Error(
      'zcMail API key is not configured for this tenant. Set it in Admin → Tenants.'
    )
  }
  if (!config.zcMailTenant.trim()) {
    throw new Error(
      'zcMail tenant is not configured for this tenant. Set zcMail tenant name in Admin → Tenants.'
    )
  }
  if (!config.zcMailBaseUrl.trim()) {
    throw new Error('zcMail base URL is not configured')
  }
  return config
}

export async function resolveTenantEmailSendConfig(
  dbName?: string | null
): Promise<ResolvedTenantEmailSendConfig> {
  const key = dbName?.trim() || ''
  if (!key) return parseTenantEmailSendConfig(null)

  const registry = await getRegistryConnection()
  const doc = (await registry.collection('clients').findOne(
    { dbName: key },
    {
      projection: {
        emailProvider: 1,
        zcMailApiKey: 1,
        zcMailBaseUrl: 1,
        zcMailTenant: 1,
        zcMailArchive: 1
      }
    }
  )) as RegistryTenantDoc | null

  return parseTenantEmailSendConfig(doc)
}

export type { TenantEmailProvider }
