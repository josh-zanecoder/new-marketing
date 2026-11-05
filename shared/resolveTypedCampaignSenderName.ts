/**
 * True when the stored "name" is empty or just the email (duplicate Sender UI).
 * Used on the LO recipient-list path to decide whether to look up first+last.
 */
export function isEmailShapedSenderDisplayName(
  name: string | null | undefined,
  email: string | null | undefined
): boolean {
  const n = String(name ?? '')
    .trim()
    .toLowerCase()
  const e = String(email ?? '')
    .trim()
    .toLowerCase()
  if (!e.includes('@')) return !n
  return !n || n === e
}

/**
 * Display name after the user types a sender email (not an LO picker select).
 * LO directory / session match → their name; otherwise tenant optional Sender name.
 * If that tenant field is empty, name stays empty (no product default inject).
 */
export function resolveTypedCampaignSenderName(params: {
  senderEmail: string | null | undefined
  /** Tenant optional `defaultCampaignSenderName` (Sender name field). */
  defaultDisplayName: string | null | undefined
  sessionEmail?: string | null
  sessionDisplayName?: string | null
  /** Exact candidate match for `senderEmail`, if any. */
  matchedCandidateDisplayName?: string | null
}): string {
  const email = String(params.senderEmail ?? '')
    .trim()
    .toLowerCase()
  const defaultName = String(params.defaultDisplayName ?? '').trim()
  const sessionEmail = String(params.sessionEmail ?? '')
    .trim()
    .toLowerCase()
  const sessionName = String(params.sessionDisplayName ?? '').trim()
  const matchedName = String(params.matchedCandidateDisplayName ?? '').trim()

  if (matchedName) return matchedName
  if (sessionEmail && email === sessionEmail && sessionName) return sessionName
  // Tenant optional Sender name — empty means empty (depends on that admin field only).
  return defaultName
}
