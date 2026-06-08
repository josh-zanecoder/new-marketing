import { getMarketingPublicBaseUrl } from './marketingPublicBaseUrl'
import { signUnsubscribeToken } from './unsubscribeToken'

/** Signed URL merged into templates as `{{unsubscribe}}`. */
export function buildUnsubscribeUrl(
  dbName: string,
  contactId: string,
  clientKeyHash: string,
  options?: { crmAppUrl?: string | null }
): string {
  const token = signUnsubscribeToken({ db: dbName, c: String(contactId) }, clientKeyHash)
  const crm = options?.crmAppUrl?.trim().replace(/\/+$/, '')
  if (crm) {
    return `${crm}/marketing/unsubscribe?token=${encodeURIComponent(token)}`
  }
  const base = getMarketingPublicBaseUrl()
  if (!base) return ''
  return `${base}/api/v1/unsubscribe?token=${encodeURIComponent(token)}`
}
