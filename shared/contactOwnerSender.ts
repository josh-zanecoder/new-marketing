/** Legacy UI label; must never be sent as Brevo From/Reply-To display name. */
export const CONTACT_OWNER_SENDER_LABEL = 'Contact owner'

export function isContactOwnerSenderPlaceholder(name: string | null | undefined): boolean {
  return String(name ?? '').trim().toLowerCase() === CONTACT_OWNER_SENDER_LABEL.toLowerCase()
}

/**
 * Prefer first + last; otherwise email. Empty when nothing usable.
 * Use for LO sender UI instead of {@link CONTACT_OWNER_SENDER_LABEL}.
 */
export function formatLoSenderDisplayName(
  firstName?: string | null,
  lastName?: string | null,
  emailFallback?: string | null
): string {
  const full = [String(firstName ?? '').trim(), String(lastName ?? '').trim()]
    .filter(Boolean)
    .join(' ')
  if (full) return full
  return String(emailFallback ?? '').trim()
}

/** Drop the legacy placeholder so callers fall through to LO / email. */
export function normalizeCampaignSenderDisplayName(
  name: string | null | undefined,
  emailFallback?: string | null
): string {
  const trimmed = String(name ?? '').trim()
  if (!trimmed || isContactOwnerSenderPlaceholder(trimmed)) {
    return String(emailFallback ?? '').trim()
  }
  return trimmed
}
