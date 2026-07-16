import { getRegistryConnection } from '../../lib/mongoose'
import type { RegistryTenantDoc } from '../../types/registry/registryTenant.types'
import { parseRegistryBrevoApiKey } from '../registry/tenantAdminRow'

function getEnvBrevoApiKey(): string {
  try {
    const config = useRuntimeConfig()
    const key = config.brevoApiKey || process.env.BREVO_API_KEY || ''
    return typeof key === 'string' ? key.trim() : ''
  } catch {
    return (process.env.BREVO_API_KEY || '').trim()
  }
}

/** Load plaintext Brevo key from registry `clients` (or null). */
export async function loadTenantBrevoApiKey(dbName: string): Promise<string | null> {
  const key = dbName.trim()
  if (!key) return null
  const registry = await getRegistryConnection()
  const doc = (await registry.collection('clients').findOne(
    { dbName: key },
    { projection: { brevoApiKey: 1 } }
  )) as RegistryTenantDoc | null
  if (!doc) return null
  return parseRegistryBrevoApiKey(doc).brevoApiKey
}

/**
 * Prefer per-tenant `clients.brevoApiKey`; fall back to env / runtimeConfig `BREVO_API_KEY`.
 */
export async function resolveBrevoApiKey(dbName?: string | null): Promise<string> {
  if (dbName?.trim()) {
    const tenantKey = await loadTenantBrevoApiKey(dbName)
    if (tenantKey) return tenantKey
  }
  return getEnvBrevoApiKey()
}
