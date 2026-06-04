import { getMarketingPublicBaseUrl } from './marketingPublicBaseUrl'
import { signUnsubscribeToken } from './unsubscribeToken'

/** Signed URL merged into templates as `{{unsubscribe}}`. */
export function buildUnsubscribeUrl(
  dbName: string,
  contactId: string,
  clientKeyHash: string
): string {
  const base = getMarketingPublicBaseUrl()
  if (!base) return ''
  const token = signUnsubscribeToken({ db: dbName, c: String(contactId) }, clientKeyHash)
  return `${base}/api/v1/unsubscribe?token=${encodeURIComponent(token)}`
}
