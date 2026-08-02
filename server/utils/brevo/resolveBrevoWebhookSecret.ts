import { getRegistryConnection } from '../../lib/mongoose'
import type { RegistryTenantDoc } from '../../types/registry/registryTenant.types'
import { parseRegistryBrevoWebhookSecret } from '../registry/tenantAdminRow'

function getEnvBrevoWebhookSecret(): string {
  return String(process.env.BREVO_WEBHOOK_SECRET || '')
    .trim()
    .replace(/^"|"$/g, '')
}

/** Load plaintext Brevo webhook secret from registry `clients` (or null). */
export async function loadTenantBrevoWebhookSecret(
  dbName: string
): Promise<string | null> {
  const key = dbName.trim()
  if (!key) return null
  const registry = await getRegistryConnection()
  const doc = (await registry.collection('clients').findOne(
    { dbName: key },
    { projection: { brevoWebhookSecret: 1 } }
  )) as RegistryTenantDoc | null
  if (!doc) return null
  return parseRegistryBrevoWebhookSecret(doc).brevoWebhookSecret
}

/**
 * Prefer per-tenant `clients.brevoWebhookSecret`; fall back to env `BREVO_WEBHOOK_SECRET`.
 */
export async function resolveBrevoWebhookSecret(
  dbName?: string | null
): Promise<string> {
  if (dbName?.trim()) {
    const tenantSecret = await loadTenantBrevoWebhookSecret(dbName)
    if (tenantSecret) return tenantSecret
  }
  return getEnvBrevoWebhookSecret()
}
