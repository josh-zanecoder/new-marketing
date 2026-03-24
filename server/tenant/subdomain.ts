export function normalizeTenantSubdomain(raw: string): string {
  const s = raw.trim().toLowerCase()
  if (!s) throw createError({ statusCode: 400, message: 'subdomain is required' })
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(s)) {
    throw createError({
      statusCode: 400,
      message: 'subdomain must be 1-63 chars: lowercase letters, digits, hyphens; no leading/trailing hyphen'
    })
  }
  return s
}

const ADMIN_SUBDOMAINS = ['admin', 'superadmin']

export function isAdminSubdomain(sub: string | null): boolean {
  if (!sub) return false
  const s = sub.trim().toLowerCase()
  return ADMIN_SUBDOMAINS.includes(s) || s.startsWith('admin-')
}

export function extractSubdomainFromHost(host: string, baseDomain?: string): string | null {
  if (!host) return null
  const hostname = host.split(':')[0]?.toLowerCase() || ''
  if (!hostname) return null
  const parts = hostname.split('.')
  if (parts.length < 2) return null
  const base = (baseDomain || '').toLowerCase().trim()
  if (base && hostname.endsWith(base)) {
    const baseParts = base.split('.')
    if (parts.length <= baseParts.length) return null
    const idx = parts.length - baseParts.length - 1
    const candidate = idx >= 0 ? parts[idx] : ''
    return candidate || null
  }
  if (hostname.includes('localhost')) return parts[0] === 'localhost' ? null : (parts[0] || null)
  if (parts.length >= 3) return parts[0] || null
  return null
}
