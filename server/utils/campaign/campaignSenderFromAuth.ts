import type { ResolvedCampaignSenderDefaults } from '@server/utils/campaign/resolveDefaultCampaignSender'
import {
  CAMPAIGN_SENDER_MODE_CONTACT_OWNER,
  CAMPAIGN_SENDER_MODE_SELECTED,
  parseCampaignSenderMode,
  type CampaignSenderMode
} from '~~/shared/campaignSenderMode'
import { isContactOwnerSenderPlaceholder } from '~~/shared/contactOwnerSender'
import {
  DEFAULT_CAMPAIGN_SENDER_EMAIL,
  DEFAULT_CAMPAIGN_SENDER_NAME
} from '~~/shared/defaultCampaignSender'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type ResolvedCampaignSenderForPersistence = {
  name: string
  email: string
  senderMode: CampaignSenderMode
}

function normalizeBodyEmail(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
}

/**
 * Campaign `sender` (+ `senderMode`) stored on save.
 *
 * When `allowTenantEditSender` is false: existing flow — default name; email from body
 * when present (preserves custom From on edit), else registry default. Always
 * `senderMode: contact_owner` so send keeps per-contact owner rewrite.
 *
 * When true and body asks for `selected`: store LO name+email and `senderMode: selected`
 * (caller must allowlist the email). Otherwise stay on `contact_owner` even if the
 * tenant toggle is on — so flipping the toggle alone does not change old campaigns.
 */
export function resolveCampaignSenderForPersistence(
  _auth: unknown,
  defaults: ResolvedCampaignSenderDefaults,
  body?: { senderEmail?: string; senderName?: string; senderMode?: string },
  options?: { allowTenantEditSender?: boolean }
): ResolvedCampaignSenderForPersistence {
  const allow = options?.allowTenantEditSender === true
  const bodyEmail = normalizeBodyEmail(body?.senderEmail)

  if (!allow || parseCampaignSenderMode(body?.senderMode) !== CAMPAIGN_SENDER_MODE_SELECTED) {
    const email = bodyEmail || defaults.email || DEFAULT_CAMPAIGN_SENDER_EMAIL
    if (bodyEmail && !EMAIL_RE.test(bodyEmail)) {
      throw createError({ statusCode: 400, message: 'Invalid sender email' })
    }
    // Admin blanks are allowed in the UI when edit-sender is on; persist a usable From fallback.
    return {
      name: defaults.name.trim() || DEFAULT_CAMPAIGN_SENDER_NAME,
      email: EMAIL_RE.test(email) ? email : DEFAULT_CAMPAIGN_SENDER_EMAIL,
      senderMode: CAMPAIGN_SENDER_MODE_CONTACT_OWNER
    }
  }

  const email = bodyEmail || defaults.email
  if (!EMAIL_RE.test(email)) {
    throw createError({ statusCode: 400, message: 'Invalid sender email' })
  }

  const rawName = String(body?.senderName ?? '').trim()
  const effectiveName =
    !rawName || isContactOwnerSenderPlaceholder(rawName) ? '' : rawName
  const name = effectiveName || email

  return {
    name,
    email,
    senderMode: CAMPAIGN_SENDER_MODE_SELECTED
  }
}
