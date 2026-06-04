import type { RegistryTenantDoc, TenantAdminRow } from '@server/types/registry/registryTenant.types'

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
    defaultCampaignSenderName
  }
}
