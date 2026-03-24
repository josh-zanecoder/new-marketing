type TenantHostContext = {
  baseDomain: string
  host: string
  subdomain: string
  isAdminHost: boolean
  isTenantHost: boolean
}

const ADMIN_SUBDOMAINS = new Set(['admin', 'superadmin'])
const RESERVED_SUBDOMAINS = new Set(['www', 'api'])

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().split(':')[0] || ''
}

function normalizeSubdomain(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
}

function extractSubdomain(host: string, baseDomain: string): string {
  const normalizedHost = normalizeHost(host)
  const normalizedBase = normalizeHost(baseDomain)
  if (!normalizedHost || normalizedHost === normalizedBase) return ''
  if (normalizedBase && normalizedHost.endsWith(`.${normalizedBase}`)) {
    const candidate = normalizedHost.slice(0, -(normalizedBase.length + 1))
    return normalizeSubdomain((candidate.split('.')[0] || '').trim())
  }
  return normalizeSubdomain((normalizedHost.split('.')[0] || '').trim())
}

export function useTenantHostContext(): TenantHostContext {
  const config = useRuntimeConfig()
  const baseDomain = normalizeHost(String(config.public.tenantBaseDomain || 'marketing.local'))
  const serverHost = import.meta.server ? normalizeHost(String(useRequestHeaders(['host']).host || '')) : ''
  const clientHost = import.meta.client ? normalizeHost(window.location.hostname) : ''
  const host = clientHost || serverHost
  const subdomain = extractSubdomain(host, baseDomain)
  const isAdminHost = !subdomain || ADMIN_SUBDOMAINS.has(subdomain)
  const isTenantHost = !!subdomain && !isAdminHost && !RESERVED_SUBDOMAINS.has(subdomain)
  return { baseDomain, host, subdomain, isAdminHost, isTenantHost }
}
