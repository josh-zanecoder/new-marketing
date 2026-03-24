export function useTenantApiHeaders(): Record<string, string> {
  if (import.meta.client) {
    const { getTenantHeaders } = useTenant()
    return getTenantHeaders()
  }
  const headers = useRequestHeaders(['x-tenant-subdomain', 'host']) as Record<string, string>
  if (headers['x-tenant-subdomain']) return { 'x-tenant-subdomain': headers['x-tenant-subdomain'] }
  const host = headers.host || ''
  const hostname = host.split(':')[0]?.toLowerCase() || ''
  const parts = hostname.split('.')
  if (hostname.includes('localhost') && parts[0] && parts[0] !== 'localhost') {
    return { 'x-tenant-subdomain': parts[0] }
  }
  return {}
}

export function useTenantFetchOptions(): { headers?: Record<string, string> } {
  const headers = useTenantApiHeaders()
  return Object.keys(headers).length ? { headers } : {}
}
