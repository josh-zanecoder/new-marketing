import type { RegistryTenantDoc, TenantAdminRow } from '@server/types/registry/registryTenant.types'
import {
  parseTenantEmailProvider,
  TENANT_EMAIL_PROVIDER_ZC_MAIL,
  type TenantEmailProvider
} from '@server/constants/emailProvider'
import { normalizeZcMailBaseUrl } from '@server/utils/zcmail/zcMailFromAddress'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function parseRegistryCampaignSenderFields(doc: RegistryTenantDoc): {
  defaultCampaignSenderEmail: string | null
  defaultCampaignSenderName: string | null
} {
  const emailRaw = doc.defaultCampaignSenderEmail
  const defaultCampaignSenderEmail =
    typeof emailRaw === 'string' && emailRaw.trim()
      ? emailRaw.trim().toLowerCase()
      : null

  const nameRaw = doc.defaultCampaignSenderName
  const defaultCampaignSenderName =
    typeof nameRaw === 'string' && nameRaw.trim() ? nameRaw.trim() : null

  return { defaultCampaignSenderEmail, defaultCampaignSenderName }
}

export function normalizeCampaignSenderEmailInput(
  raw: string | null | undefined
): string | null {
  if (raw === null || raw === undefined) return null
  const trimmed = String(raw).trim()
  if (!trimmed) return null
  const e = trimmed.toLowerCase()
  if (!EMAIL_RE.test(e)) {
    throw createError({ statusCode: 400, message: 'Invalid default campaign sender email' })
  }
  return e
}

export function normalizeCampaignSenderNameInput(
  raw: string | null | undefined
): string | null {
  if (raw === null || raw === undefined) return null
  const trimmed = String(raw).trim()
  return trimmed || null
}

/** Mask a Brevo API key for admin display (never return the full secret). */
export function maskBrevoApiKeyPrefix(raw: string): string | null {
  const key = raw.trim()
  if (!key) return null
  if (key.length < 8) return '••••'
  return `${key.slice(0, 4)}…${key.slice(-4)}`
}

/** Normalize admin input: empty → null (use env). */
export function normalizeBrevoApiKeyInput(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null
  const trimmed = String(raw).trim()
  return trimmed || null
}

export function parseRegistryBrevoApiKey(doc: RegistryTenantDoc): {
  brevoApiKey: string | null
  brevoApiKeyConfigured: boolean
  brevoApiKeyPrefix: string | null
} {
  const raw = doc.brevoApiKey
  const brevoApiKey =
    typeof raw === 'string' && raw.trim() ? raw.trim() : null
  return {
    brevoApiKey,
    brevoApiKeyConfigured: Boolean(brevoApiKey),
    brevoApiKeyPrefix: brevoApiKey ? maskBrevoApiKeyPrefix(brevoApiKey) : null
  }
}

/** Normalize admin webhook-secret input: empty → null (use env). */
export function normalizeBrevoWebhookSecretInput(
  raw: string | null | undefined
): string | null {
  return normalizeBrevoApiKeyInput(raw)
}

export function parseRegistryBrevoWebhookSecret(doc: RegistryTenantDoc): {
  brevoWebhookSecret: string | null
  brevoWebhookSecretConfigured: boolean
  brevoWebhookSecretPrefix: string | null
} {
  const raw = doc.brevoWebhookSecret
  const brevoWebhookSecret =
    typeof raw === 'string' && raw.trim() ? raw.trim() : null
  return {
    brevoWebhookSecret,
    brevoWebhookSecretConfigured: Boolean(brevoWebhookSecret),
    brevoWebhookSecretPrefix: brevoWebhookSecret
      ? maskBrevoApiKeyPrefix(brevoWebhookSecret)
      : null
  }
}

export function parseRegistryZcMailFields(doc: RegistryTenantDoc): {
  emailProvider: TenantEmailProvider
  zcMailBaseUrl: string | null
  zcMailTenant: string | null
  zcMailArchive: boolean
  zcMailApiKey: string | null
  zcMailApiKeyConfigured: boolean
  zcMailApiKeyPrefix: string | null
} {
  const emailProvider = parseTenantEmailProvider(doc.emailProvider)
  const zcMailBaseUrl =
    typeof doc.zcMailBaseUrl === 'string' && doc.zcMailBaseUrl.trim()
      ? doc.zcMailBaseUrl.trim().replace(/\/+$/, '')
      : null
  const zcMailTenant =
    typeof doc.zcMailTenant === 'string' && doc.zcMailTenant.trim()
      ? doc.zcMailTenant.trim()
      : null
  const zcMailApiKey =
    typeof doc.zcMailApiKey === 'string' && doc.zcMailApiKey.trim()
      ? doc.zcMailApiKey.trim()
      : null
  return {
    emailProvider,
    zcMailBaseUrl,
    zcMailTenant,
    zcMailArchive: doc.zcMailArchive !== false,
    zcMailApiKey,
    zcMailApiKeyConfigured: Boolean(zcMailApiKey),
    zcMailApiKeyPrefix: zcMailApiKey ? maskBrevoApiKeyPrefix(zcMailApiKey) : null
  }
}

export function normalizeZcMailTenantInput(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null
  const trimmed = String(raw).trim()
  return trimmed || null
}

export function normalizeZcMailApiKeyInput(raw: string | null | undefined): string | null {
  return normalizeBrevoApiKeyInput(raw)
}

/** Apply optional zcMail fields onto `$set` / `$unset`. Validates when provider is ZC_MAIL. */
export function applyZcMailRegistryPatch(params: {
  existing: RegistryTenantDoc
  body: {
    emailProvider?: string | null
    zcMailBaseUrl?: string | null
    zcMailTenant?: string | null
    zcMailArchive?: boolean
    zcMailApiKey?: string | null
  }
  $set: Record<string, unknown>
  $unset: Record<string, ''>
}): void {
  const prev = parseRegistryZcMailFields(params.existing)
  const body = params.body

  let nextProvider = prev.emailProvider
  if (Object.prototype.hasOwnProperty.call(body, 'emailProvider') && body.emailProvider != null) {
    nextProvider = parseTenantEmailProvider(body.emailProvider)
    params.$set.emailProvider = nextProvider
  }

  if (Object.prototype.hasOwnProperty.call(body, 'zcMailBaseUrl')) {
    const next = body.zcMailBaseUrl == null || String(body.zcMailBaseUrl).trim() === ''
      ? null
      : normalizeZcMailBaseUrl(body.zcMailBaseUrl)
    if (next) params.$set.zcMailBaseUrl = next
    else params.$unset.zcMailBaseUrl = ''
    prev.zcMailBaseUrl = next
  }

  if (Object.prototype.hasOwnProperty.call(body, 'zcMailTenant')) {
    const next = normalizeZcMailTenantInput(body.zcMailTenant)
    if (next) params.$set.zcMailTenant = next
    else params.$unset.zcMailTenant = ''
    prev.zcMailTenant = next
  }

  if (Object.prototype.hasOwnProperty.call(body, 'zcMailArchive')) {
    params.$set.zcMailArchive = body.zcMailArchive !== false
    prev.zcMailArchive = body.zcMailArchive !== false
  }

  if (Object.prototype.hasOwnProperty.call(body, 'zcMailApiKey')) {
    const next = normalizeZcMailApiKeyInput(body.zcMailApiKey)
    if (next) {
      params.$set.zcMailApiKey = next
      prev.zcMailApiKey = next
      prev.zcMailApiKeyConfigured = true
    } else {
      params.$unset.zcMailApiKey = ''
      prev.zcMailApiKey = null
      prev.zcMailApiKeyConfigured = false
    }
  }

  if (nextProvider === TENANT_EMAIL_PROVIDER_ZC_MAIL) {
    const nextBase =
      (typeof params.$set.zcMailBaseUrl === 'string' && params.$set.zcMailBaseUrl) ||
      (!params.$unset.zcMailBaseUrl ? prev.zcMailBaseUrl : null)
    const nextTenant =
      (typeof params.$set.zcMailTenant === 'string' && params.$set.zcMailTenant) ||
      (!params.$unset.zcMailTenant ? prev.zcMailTenant : null)
    const nextKey =
      (typeof params.$set.zcMailApiKey === 'string' && params.$set.zcMailApiKey) ||
      (!params.$unset.zcMailApiKey ? prev.zcMailApiKey : null)
    if (!nextTenant) {
      throw createError({
        statusCode: 400,
        message: 'zcMail tenant is required when email provider is zcMail'
      })
    }
    if (!nextBase) {
      throw createError({
        statusCode: 400,
        message: 'zcMail base URL is required when email provider is zcMail'
      })
    }
    if (!nextKey) {
      throw createError({
        statusCode: 400,
        message: 'zcMail API key is required when email provider is zcMail'
      })
    }
  }
}

export function toTenantAdminRow(doc: RegistryTenantDoc): TenantAdminRow | null {
  const name = typeof doc.name === 'string' ? doc.name : ''
  const email = typeof doc.email === 'string' ? doc.email : null
  const dbName = typeof doc.dbName === 'string' ? doc.dbName : ''
  const tenantId =
    typeof doc.tenantId === 'string' && doc.tenantId ? doc.tenantId : null
  const apiKeyPrefix =
    typeof doc.clientKeyPrefix === 'string' && doc.clientKeyPrefix
      ? doc.clientKeyPrefix
      : typeof doc.apiKeyPrefix === 'string' && doc.apiKeyPrefix
        ? doc.apiKeyPrefix
        : null
  const createdAt =
    doc.createdAt instanceof Date
      ? doc.createdAt.toISOString()
      : typeof doc.createdAt === 'string'
        ? new Date(doc.createdAt).toISOString()
        : null

  const crmRaw = doc.crmAppUrl
  const crmAppUrl =
    typeof crmRaw === 'string' && crmRaw.trim()
      ? crmRaw.trim().replace(/\/+$/, '')
      : null

  const koRaw = doc.kafkaOutboundTopic
  const kafkaOutboundTopic =
    typeof koRaw === 'string' && koRaw.trim() ? koRaw.trim() : null

  const { defaultCampaignSenderEmail, defaultCampaignSenderName } =
    parseRegistryCampaignSenderFields(doc)
  const { brevoApiKeyConfigured, brevoApiKeyPrefix } = parseRegistryBrevoApiKey(doc)
  const { brevoWebhookSecretConfigured, brevoWebhookSecretPrefix } =
    parseRegistryBrevoWebhookSecret(doc)
  const zcMail = parseRegistryZcMailFields(doc)

  if (!name || !dbName || !createdAt) return null
  return {
    name,
    email,
    dbName,
    tenantId,
    apiKeyPrefix,
    createdAt,
    crmAppUrl,
    kafkaOutboundTopic,
    defaultCampaignSenderEmail,
    defaultCampaignSenderName,
    brevoApiKeyConfigured,
    brevoApiKeyPrefix,
    brevoWebhookSecretConfigured,
    brevoWebhookSecretPrefix,
    emailProvider: zcMail.emailProvider,
    zcMailBaseUrl: zcMail.zcMailBaseUrl,
    zcMailTenant: zcMail.zcMailTenant,
    zcMailArchive: zcMail.zcMailArchive,
    zcMailApiKeyConfigured: zcMail.zcMailApiKeyConfigured,
    zcMailApiKeyPrefix: zcMail.zcMailApiKeyPrefix
  }
}
