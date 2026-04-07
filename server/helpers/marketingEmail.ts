/** Practical local-part + domain check for marketing sends (not full RFC 5322). */
const MARKETING_EMAIL =
  /^[a-z0-9](?:[a-z0-9._+-]*[a-z0-9])?@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i

export function normalizeMarketingEmail(raw: string | undefined | null): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
}

export function isValidMarketingEmail(email: string): boolean {
  const e = email.trim().toLowerCase()
  if (e.length < 3 || e.length > 254) return false
  // Fast rejects before regex (hot path during recipient validation).
  if (e.includes(' ')) return false
  const at = e.indexOf('@')
  if (at <= 0 || at !== e.lastIndexOf('@')) return false
  if (e.indexOf('.', at + 2) === -1) return false
  return MARKETING_EMAIL.test(e)
}
