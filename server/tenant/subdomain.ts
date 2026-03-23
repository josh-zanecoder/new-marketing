/** DNS label for tenant subdomain (e.g. `acme` for `acme.app.example.com`). */
export function normalizeTenantSubdomain(raw: string): string {
  const s = raw.trim().toLowerCase()
  if (!s) {
    throw createError({ statusCode: 400, message: 'subdomain is required' })
  }
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(s)) {
    throw createError({
      statusCode: 400,
      message:
        'subdomain must be 1–63 characters: lowercase letters, digits, hyphens only; no leading or trailing hyphen'
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

export function extractSubdomainFromHost(
  host: string,
  baseDomain?: string
): string | null {
  if (!host || typeof host !== 'string') return null
  const hostname = host.split(':')[0]?.toLowerCase() || ''
  const parts = hostname.split('.')
  if (parts.length < 2) return null
  const base = (baseDomain || '').toLowerCase().trim()
  if (base && hostname.endsWith(base) && parts.length > base.split('.').length) {
    const idx = parts.length - base.split('.').length - 1
    if (idx >= 0) {
      const c = parts[idx]
      if (c && !['www', 'api'].includes(c)) return c.toLowerCase()
    }
  }
  if (['localhost', 'www', 'api'].includes(parts[0])) return null
  if (hostname.includes('localhost')) return parts[0]
  if (parts.length >= 3) return parts[0]
  return null
}
