import { getMarketingPublicBaseUrl } from './marketingPublicBaseUrl'
import { signUnsubscribeToken } from './unsubscribeToken'

/**
 * Signed URL merged into `{{unsubscribe}}` (manual inserts + gating auto-footer).
 * Always uses new-marketing public `/api/v1/unsubscribe` — not CRM/Retail `crmAppUrl`
 * (that host has no public preference page and redirects recipients to login).
 */
export function buildUnsubscribeUrl(
  dbName: string,
  contactId: string,
  clientKeyHash: string,
  _options?: { crmAppUrl?: string | null }
): string {
  const token = signUnsubscribeToken({ db: dbName, c: String(contactId) }, clientKeyHash)
  const base = getMarketingPublicBaseUrl()
  if (!base) return ''
  return `${base}/api/v1/unsubscribe?token=${encodeURIComponent(token)}`
}
