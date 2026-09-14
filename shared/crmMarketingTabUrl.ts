/** Max length for a Marketing tenant path carried on CRM `/marketing?path=`. */
export const MARKETING_EMBED_PATH_MAX_LEN = 1024

/**
 * Allow only in-app tenant paths (`/tenant/...`) so `next` / `path` cannot open off-site URLs.
 */
export function safeMarketingTenantPath(raw: unknown): string {
  const s = Array.isArray(raw) ? String(raw[0] ?? '') : String(raw ?? '')
  const trimmed = s.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) return ''
  if (trimmed.length > MARKETING_EMBED_PATH_MAX_LEN) return ''
  let u: URL
  try {
    u = new URL(trimmed, 'https://marketing.invalid')
  } catch {
    return ''
  }
  if (u.username || u.password) return ''
  if (!u.pathname.startsWith('/tenant/')) return ''
  return `${u.pathname}${u.search}${u.hash}`
}

export function originFromHttpUrl(raw?: string | null): string {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  const withProto = /^https?:\/\//i.test(s) ? s : `https://${s}`
  try {
    const u = new URL(withProto)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return ''
    if (u.username || u.password) return ''
    return u.origin
  } catch {
    return ''
  }
}

/** CRM Marketing embed page (`https://crm.example.com/marketing`). */
export function crmMarketingPageBase(
  crmAppUrl?: string | null,
  referrer?: string | null,
  selfOrigin?: string | null
): string {
  const fromApp = originFromHttpUrl(crmAppUrl)
  if (fromApp) return `${fromApp}/marketing`
  const fromRef = originFromHttpUrl(referrer)
  const self = originFromHttpUrl(selfOrigin)
  if (fromRef && fromRef !== self) return `${fromRef}/marketing`
  return ''
}

/** New-tab URL that stays in CRM chrome with the same Marketing page in the iframe. */
export function buildCrmMarketingTabUrl(crmMarketingBase: string, marketingPath: string): string {
  const path = safeMarketingTenantPath(marketingPath)
  const base = String(crmMarketingBase ?? '').trim()
  if (!base) return ''
  let u: URL
  try {
    u = new URL(base.includes('://') ? base : `https://${base}`)
  } catch {
    return ''
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return ''
  u.pathname = '/marketing'
  u.search = ''
  u.hash = ''
  if (path) u.searchParams.set('path', path)
  return u.toString()
}

export function marketingTenantPathFromHref(href: string, marketingOrigin: string): string {
  const raw = String(href ?? '').trim()
  if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:')) return ''
  try {
    const u = new URL(raw, marketingOrigin)
    if (u.origin !== new URL(marketingOrigin).origin) return ''
    return safeMarketingTenantPath(`${u.pathname}${u.search}${u.hash}`)
  } catch {
    return ''
  }
}
