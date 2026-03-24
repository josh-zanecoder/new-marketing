const TENANT_STORAGE_KEY = 'marketing_selected_tenant'

function baseDomain(): string {
  const config = useRuntimeConfig()
  const pub = config.public as Record<string, string>
  return String(pub.tenantBaseDomain || '').toLowerCase()
}

function extractSubdomain(hostname: string): string | null {
  if (!hostname) return null
  const host = hostname.split(':')[0]?.toLowerCase() || ''
  const parts = host.split('.')
  if (parts.length < 2) return null
  const base = baseDomain()
  if (base && host.endsWith(base)) {
    const baseParts = base.split('.')
    if (parts.length <= baseParts.length) return null
    const idx = parts.length - baseParts.length - 1
    return idx >= 0 ? parts[idx] || null : null
  }
  if (host.includes('localhost')) return parts[0] === 'localhost' ? null : parts[0]
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
    if (!import.meta.client) return ''
    return localStorage.getItem(TENANT_STORAGE_KEY) || ''
  })

  const subdomain = computed(() => {
    if (import.meta.server) return selectedTenant.value || ''
    const ext = extractSubdomain(window.location.hostname || '')
    return ext || selectedTenant.value || ''
  })

  const isSuperAdminContext = computed(() => !subdomain.value || isAdminSubdomain(subdomain.value))
  const hasTenantContext = computed(() => !!subdomain.value && !isAdminSubdomain(subdomain.value))

  function setSelectedTenant(sub: string) {
    selectedTenant.value = sub || ''
    if (!import.meta.client) return
    if (sub) localStorage.setItem(TENANT_STORAGE_KEY, sub)
    else localStorage.removeItem(TENANT_STORAGE_KEY)
  }

  function getTenantHeaders(): Record<string, string> {
    const s = subdomain.value
    if (!s || isAdminSubdomain(s)) return {}
    return { 'X-Tenant-Subdomain': s }
  }

  return { subdomain, isSuperAdminContext, hasTenantContext, selectedTenant, setSelectedTenant, getTenantHeaders }
}
