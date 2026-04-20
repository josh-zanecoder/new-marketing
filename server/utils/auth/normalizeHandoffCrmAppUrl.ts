const MAX_HANDOFF_CRM_URL_LEN = 2048

/**
 * Normalize and validate a CRM / tenant app base URL from a signed handoff JWT.
 * Rejects non-http(s) schemes, credentials, and absurd lengths to limit open-redirect abuse
 * if a token is ever leaked.
 */
export function normalizeHandoffCrmAppUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const s = raw.trim()
  if (!s || s.length > MAX_HANDOFF_CRM_URL_LEN) return undefined
  const withProto = /^https?:\/\//i.test(s) ? s : `https://${s}`
  let u: URL
  try {
    u = new URL(withProto)
  } catch {
    return undefined
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return undefined
  if (u.username || u.password) return undefined
  const href = u.href.split('#')[0] ?? ''
  const noSlash = href.replace(/\/+$/, '')
  return noSlash || undefined
}
