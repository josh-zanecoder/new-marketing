import { buildOneClickUnsubscribeUrl } from '../unsubscribeUrl'

/** RFC 8058 headers Gmail/Yahoo require on bulk mail. */
export function buildListUnsubscribeHeaders(
  oneClickUrl: string
): Record<string, string> | undefined {
  const url = oneClickUrl.trim()
  if (!url || !/^https:\/\//i.test(url)) return undefined
  return {
    'List-Unsubscribe': `<${url}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
  }
}

/** Per-contact one-click headers, or undefined when the public marketing API is unset. */
export function listUnsubscribeHeadersForContact(params: {
  dbName?: string | null
  contactId?: string | null
  clientKeyHash?: string | null
}): Record<string, string> | undefined {
  const dbName = String(params.dbName ?? '').trim()
  const contactId = String(params.contactId ?? '').trim()
  const clientKeyHash = String(params.clientKeyHash ?? '').trim()
  if (!dbName || !contactId || !clientKeyHash) return undefined
  return buildListUnsubscribeHeaders(
    buildOneClickUnsubscribeUrl(dbName, contactId, clientKeyHash)
  )
}
