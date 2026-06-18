import { getUnsubscribePageUrl } from './unsubscribePageUrl'
import { signUnsubscribeToken } from './unsubscribeToken'

/** Signed URL merged into templates as `{{unsubscribe}}` (CRM confirmation page). */
export function buildUnsubscribeUrl(
  dbName: string,
  contactId: string,
  clientKeyHash: string,
  crmAppUrl?: string | null
): string {
  const pageUrl = getUnsubscribePageUrl(crmAppUrl)
  if (!pageUrl) return ''
  const token = signUnsubscribeToken({ db: dbName, c: String(contactId) }, clientKeyHash)
  return `${pageUrl}?token=${encodeURIComponent(token)}`
}
