import { getMarketingPublicBaseUrl } from './marketingPublicBaseUrl'
import { signUnsubscribeToken } from './unsubscribeToken'

/** Origin only — registry/handoff `crmAppUrl` may include a deep “Back to CRM” path. */
function originFromCrmAppUrl(raw?: string | null): string {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  const withProto = /^https?:\/\//i.test(s) ? s : `https://${s}`
  try {
    const u = new URL(withProto)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return ''
    return u.origin
  } catch {
    return ''
  }
}

/**
 * Signed URL for `{{unsubscribe}}` (manual + gating auto-footer).
 * Prefer new-marketing public `/api/v1/unsubscribe`. Fall back to CRM SPA origin only
 * when marketing public base is unset — never emit an empty href (looks underlined, not clickable).
 */
export function buildUnsubscribeUrl(
  dbName: string,
  contactId: string,
  clientKeyHash: string,
  options?: { crmAppUrl?: string | null }
): string {
  const token = signUnsubscribeToken({ db: dbName, c: String(contactId) }, clientKeyHash)
  const base = getMarketingPublicBaseUrl()
  if (base) {
    return `${base}/api/v1/unsubscribe?token=${encodeURIComponent(token)}`
  }
  const crmOrigin = originFromCrmAppUrl(options?.crmAppUrl)
  if (crmOrigin) {
    return `${crmOrigin}/marketing/unsubscribe?token=${encodeURIComponent(token)}`
  }
  return ''
}
