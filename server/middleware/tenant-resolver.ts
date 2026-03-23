import { getRegistryConnection } from '../lib/mongoose'
import { findRegistryTenantBySubdomain } from '../tenant/registry-auth'
import { extractSubdomainFromHost, isAdminSubdomain } from '../tenant/subdomain'
import type { RegistryTenantRow } from '../tenant/registry-auth'

declare module 'h3' {
  interface H3EventContext {
    tenantFromSubdomain?: RegistryTenantRow | null
  }
}

export default defineEventHandler(async (event) => {
  const path = event.path || ''
  if (!path.startsWith('/api/')) return

  const config = useRuntimeConfig()
  const baseDomain = (config.tenantBaseDomain as string) || ''

  const headerSub = getHeader(event, 'x-tenant-subdomain')
  const host = getHeader(event, 'host') || event.node.req?.headers?.host || ''
  const hostSub = extractSubdomainFromHost(host, baseDomain)

  const subdomain = (
    (typeof headerSub === 'string' ? headerSub : '') ||
    hostSub ||
    ''
  )
    .trim()
    .toLowerCase()

  if (!subdomain || isAdminSubdomain(subdomain)) {
    event.context.tenantFromSubdomain = null
    return
  }

  try {
    const registry = await getRegistryConnection()
    const tenant = await findRegistryTenantBySubdomain(registry, subdomain)
    event.context.tenantFromSubdomain = tenant ?? null
  } catch {
    event.context.tenantFromSubdomain = null
  }
})
