/**
 * Display name after the user types a sender email (not an LO picker select).
 * Existing LO / session match → their name; otherwise the tenant display-name field.
 */
export function resolveTypedCampaignSenderName(params: {
  senderEmail: string | null | undefined
  /** Tenant `defaultCampaignSenderName` (display name field). */
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
  if (defaultName) return defaultName
  return email
}
