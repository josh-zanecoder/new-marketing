export function normalizeCrmAppUrl(raw: string | undefined | null): string {
  return String(raw ?? '').trim().replace(/\/+$/, '')
}

/** Public unsubscribe confirmation URL on the tenant CRM (no query string). */
export function getUnsubscribePageUrl(crmAppUrl?: string | null): string {
  const crm = normalizeCrmAppUrl(crmAppUrl)
  if (!crm) return ''
  return `${crm}/marketing/unsubscribe`
}
