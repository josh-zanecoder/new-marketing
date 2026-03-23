function extractSubdomainFromHost(host: string, baseDomain: string): string | null {
  if (!host) return null
  const hostname = host.split(':')[0].toLowerCase()
  const parts = hostname.split('.')
  if (parts.length < 2) return null
  if (hostname.includes('localhost')) {
    if (parts[0] === 'localhost') return null
    return parts[0]
  }
  const baseParts = baseDomain ? baseDomain.split('.') : []
  if (baseDomain && parts.length > baseParts.length) {
    const idx = parts.length - baseParts.length - 1
    if (idx >= 0 && parts[idx] && !['www', 'api'].includes(parts[idx])) return parts[idx]
  }
  return parts.length >= 3 ? parts[0] : null
}

export function useTenantApiHeaders(): Record<string, string> {
  const out: Record<string, string> = {}
  if (import.meta.client) {
    const { getTenantHeaders } = useTenant()
    Object.assign(out, getTenantHeaders())
  } else {
    try {
      const headers = useRequestHeaders() as Record<string, string>
      let sub = headers['x-tenant-subdomain']
      if (!sub && headers.host) {
        const config = useRuntimeConfig()
        const base = (config.public as { tenantBaseDomain?: string })?.tenantBaseDomain ?? ''
        sub = extractSubdomainFromHost(headers.host, base) ?? ''
      }
      if (typeof sub === 'string' && sub && !['admin', 'superadmin'].includes(sub.toLowerCase())) {
        out['x-tenant-subdomain'] = sub
      }
    } catch {}
  }
  return out
}

export function useTenantFetchOptions(): { headers?: Record<string, string> } {
  const headers = useTenantApiHeaders()
  return Object.keys(headers).length ? { headers } : {}
}
