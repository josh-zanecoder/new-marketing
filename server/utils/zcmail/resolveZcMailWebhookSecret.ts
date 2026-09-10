import { getRegistryConnection } from '../../lib/mongoose'
import type { RegistryTenantDoc } from '../../types/registry/registryTenant.types'
import { parseRegistryZcMailWebhookSecret } from '../registry/tenantAdminRow'

function getEnvZcMailWebhookSecret(): string {
  return String(process.env.ZC_MAIL_WEBHOOK_SECRET || '')
    .trim()
    .replace(/^"|"$/g, '')
}

/** Load plaintext zcMail webhook HMAC secret from registry `clients` (or null). */
export async function loadTenantZcMailWebhookSecret(
  dbName: string
): Promise<string | null> {
  const key = dbName.trim()
  if (!key) return null
  const registry = await getRegistryConnection()
  const doc = (await registry.collection('clients').findOne(
    { dbName: key },
    { projection: { zcMailWebhookSecret: 1 } }
  )) as RegistryTenantDoc | null
  if (!doc) return null
  return parseRegistryZcMailWebhookSecret(doc).zcMailWebhookSecret
}

/**
 * Prefer per-tenant `clients.zcMailWebhookSecret`; fall back to env `ZC_MAIL_WEBHOOK_SECRET`.
 */
export async function resolveZcMailWebhookSecret(
  dbName?: string | null
): Promise<string> {
  if (dbName?.trim()) {
    const tenantSecret = await loadTenantZcMailWebhookSecret(dbName)
    if (tenantSecret) return tenantSecret
  }
  return getEnvZcMailWebhookSecret()
}
