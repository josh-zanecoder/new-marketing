/**
 * LO-recipient-list flag path: name/email search on recipient-list detail members.
 * Classic (flag OFF) UI does not expose this; empty `q` keeps API behavior unchanged.
 */

export const RECIPIENT_LIST_MEMBER_SEARCH_MIN_LEN = 2
export const RECIPIENT_LIST_MEMBER_SEARCH_MAX_LEN = 120

export function normalizeRecipientListMemberSearchQ(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .slice(0, RECIPIENT_LIST_MEMBER_SEARCH_MAX_LEN)
}

export function isActiveRecipientListMemberSearch(q: string): boolean {
  return q.length >= RECIPIENT_LIST_MEMBER_SEARCH_MIN_LEN
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Mongo `$or` clauses for contact name/email contains search (case-insensitive). */
export function recipientListMemberSearchOrClauses(q: string): Record<string, unknown>[] {
  const rx = escapeRegex(q)
  return [
    { email: { $regex: rx, $options: 'i' } },
    { firstName: { $regex: rx, $options: 'i' } },
    { lastName: { $regex: rx, $options: 'i' } },
    { name: { $regex: rx, $options: 'i' } }
  ]
}
