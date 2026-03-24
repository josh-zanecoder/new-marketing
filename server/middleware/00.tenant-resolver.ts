import type { RegistryTenantRow } from '../tenant/registry-auth'
import { getRegistryConnection } from '../lib/mongoose'
import { findRegistryTenantBySubdomain } from '../tenant/registry-auth'
import { extractSubdomainFromHost, isAdminSubdomain } from '../tenant/subdomain'

declare module 'h3' {
  interface H3EventContext {
    tenantFromSubdomain?: RegistryTenantRow | null
  }
}

export default defineEventHandler(async (event) => {
  const path = event.path || ''
  if (!path.startsWith('/api/')) return
  const config = useRuntimeConfig()
  const baseDomain = String(config.tenantBaseDomain || '')
  const headerSub = getHeader(event, 'x-tenant-subdomain') || ''
  const host = getHeader(event, 'host') || ''
  const hostSub = extractSubdomainFromHost(host, baseDomain) || ''
  const subdomain = String(headerSub || hostSub).trim().toLowerCase()
  if (!subdomain || isAdminSubdomain(subdomain)) {
    event.context.tenantFromSubdomain = null
    return
  }
  try {
    const registry = await getRegistryConnection()
    event.context.tenantFromSubdomain = await findRegistryTenantBySubdomain(registry, subdomain)
  } catch {
    event.context.tenantFromSubdomain = null
  }
})
