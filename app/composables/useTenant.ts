const TENANT_STORAGE_KEY = 'marketing_selected_tenant'

function getBaseDomain(): string {
  const config = useRuntimeConfig()
  return ((config.public as Record<string, string>)?.tenantBaseDomain ?? '').toLowerCase()
}

function extractSubdomain(hostname: string): string | null {
  if (!hostname) return null
  const host = hostname.split(':')[0]?.toLowerCase() || ''
  const parts = host.split('.')
  if (parts.length < 2) return null
  const baseDomain = getBaseDomain()
  const baseParts = baseDomain.split('.')
  if (baseDomain && host.endsWith(baseDomain) && parts.length > baseParts.length) {
    const idx = parts.length - baseParts.length - 1
    if (idx >= 0) {
      const c = parts[idx]
      if (c && !['www', 'api'].includes(c)) return c.toLowerCase()
    }
  }
  if (['localhost', 'www', 'api'].includes(parts[0])) return null
  if (host.includes('localhost')) return parts[0]
  if (parts.length >= 3) return parts[0]
  return null
}

function isAdminSubdomain(sub: string | null): boolean {
  if (!sub) return false
  const s = sub.trim().toLowerCase()
  return s === 'admin' || s === 'superadmin' || s.startsWith('admin-')
}

export function useTenant() {
  const selectedTenant = useState<string>(TENANT_STORAGE_KEY, () => {
    if (import.meta.client) {
      return localStorage.getItem(TENANT_STORAGE_KEY) || ''
    }
    return ''
  })

  const subdomain = computed(() => {
    if (import.meta.server) return selectedTenant.value || ''
    const host = window.location?.hostname || ''
    const ext = extractSubdomain(host)
    if (ext) return ext
    return selectedTenant.value || ''
  })

  const isSuperAdminContext = computed(() => {
    if (import.meta.server) return !selectedTenant.value || isAdminSubdomain(selectedTenant.value)
    const host = window.location?.hostname || ''
    const ext = extractSubdomain(host)
    if (!ext) return !selectedTenant.value || isAdminSubdomain(selectedTenant.value)
    return isAdminSubdomain(ext)
  })

  const hasTenantContext = computed(() => {
    const s = subdomain.value
    return !!s && !isAdminSubdomain(s)
  })

  function setSelectedTenant(sub: string) {
    selectedTenant.value = sub || ''
    if (import.meta.client) {
      if (sub) localStorage.setItem(TENANT_STORAGE_KEY, sub)
      else localStorage.removeItem(TENANT_STORAGE_KEY)
    }
  }

  function getTenantHeaders(): Record<string, string> {
    const s = subdomain.value
    if (!s || isAdminSubdomain(s)) return {}
    return { 'X-Tenant-Subdomain': s }
  }

  return {
    subdomain,
    isSuperAdminContext,
    hasTenantContext,
    selectedTenant,
    setSelectedTenant,
    getTenantHeaders
  }
}
