import { normalizeMarketingEmail } from '@server/helpers/marketingEmail'

type EmailIdentity = {
  email?: string | null
  updatedAt?: string | Date | null
  is_unsubscribe?: boolean
}

function updatedAtMillis(value: string | Date | null | undefined): number {
  if (value instanceof Date) {
    const time = value.getTime()
    return Number.isNaN(time) ? 0 : time
  }
  if (typeof value === 'string' && value.trim()) {
    const time = Date.parse(value)
    return Number.isNaN(time) ? 0 : time
  }
  return 0
}

/**
 * One row per email. Input should be newest-first; the first row for an email
 * wins unless a later row is strictly newer. Opt-out wins if any copy is unsubscribed.
 * Rows with no email are kept as-is.
 */
export function dedupeContactsByEmail<T extends EmailIdentity>(rows: T[]): T[] {
  const order: string[] = []
  const byEmail = new Map<string, T>()
  const withoutEmail: T[] = []

  for (const row of rows) {
    const email = normalizeMarketingEmail(row.email)
    if (!email) {
      withoutEmail.push(row)
      continue
    }

    const prev = byEmail.get(email)
    if (!prev) {
      order.push(email)
      byEmail.set(email, row)
      continue
    }

    const incomingIsNewer = updatedAtMillis(row.updatedAt) > updatedAtMillis(prev.updatedAt)
    const unsubscribed = prev.is_unsubscribe === true || row.is_unsubscribe === true
    const chosen = incomingIsNewer ? row : prev
    if (unsubscribed && chosen.is_unsubscribe !== true) {
      byEmail.set(email, { ...chosen, is_unsubscribe: true })
    } else if (incomingIsNewer) {
      byEmail.set(email, chosen)
    }
  }

  return [...order.map((email) => byEmail.get(email)!), ...withoutEmail]
}
