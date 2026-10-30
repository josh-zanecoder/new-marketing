import {
  CAMPAIGN_SENDER_MODE_CONTACT_OWNER,
  CAMPAIGN_SENDER_MODE_SELECTED,
  type CampaignSenderMode
} from './campaignSenderMode'

/**
 * When superadmin allows editing sender:
 * - Explicit LO pick (`preferredMode: selected`) → selected
 * - Complete typed email that matches directory/session (`directoryMatch: true`) → selected
 * - Complete typed email with no directory match → contact_owner (save/test allowlist parity)
 * - Partial search text without `@` → contact_owner
 *
 * Pass `directoryMatch` from the candidates lookup when typing; omit it when the LO
 * was picked from the list (`preferredMode: selected`).
 */
export function resolveEditableCampaignSenderMode(params: {
  allowTenantEditSender: boolean
  senderEmail: string | null | undefined
  /** Explicit LO pick; otherwise inferred from a complete directory-matched email. */
  preferredMode?: CampaignSenderMode | string | null
  /**
   * True when sender email is the session user or an LO candidate.
   * False when a complete typed email is not in the directory.
   * Omit when unknown (e.g. save path uses preferredMode only).
   */
  directoryMatch?: boolean | null
}): CampaignSenderMode {
  if (!params.allowTenantEditSender) return CAMPAIGN_SENDER_MODE_CONTACT_OWNER
  if (params.preferredMode === CAMPAIGN_SENDER_MODE_SELECTED) {
    return CAMPAIGN_SENDER_MODE_SELECTED
  }
  const email = String(params.senderEmail ?? '')
    .trim()
    .toLowerCase()
  if (!email.includes('@')) return CAMPAIGN_SENDER_MODE_CONTACT_OWNER
  if (params.directoryMatch === false) return CAMPAIGN_SENDER_MODE_CONTACT_OWNER
  if (params.directoryMatch === true) return CAMPAIGN_SENDER_MODE_SELECTED
  // Save path often omits directoryMatch and passes the form's preferredMode.
  // Honor an explicit contact_owner so typed non-directory emails are not flipped to selected.
  if (params.preferredMode === CAMPAIGN_SENDER_MODE_CONTACT_OWNER) {
    return CAMPAIGN_SENDER_MODE_CONTACT_OWNER
  }
  // Unknown match status + no preferred mode: complete email → selected (legacy callers).
  return CAMPAIGN_SENDER_MODE_SELECTED
}
