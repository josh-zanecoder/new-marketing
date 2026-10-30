/**
 * How campaign From identity is resolved at send time.
 *
 * - `contact_owner` (default / missing): existing per-contact owner rewrite.
 * - `selected`: use stored `campaign.sender` as-is (LO pick while Edit sender is ON).
 *
 * Old campaigns without this field behave as `contact_owner`.
 */
export const CAMPAIGN_SENDER_MODE_CONTACT_OWNER = 'contact_owner' as const
export const CAMPAIGN_SENDER_MODE_SELECTED = 'selected' as const

export type CampaignSenderMode =
  | typeof CAMPAIGN_SENDER_MODE_CONTACT_OWNER
  | typeof CAMPAIGN_SENDER_MODE_SELECTED

export function parseCampaignSenderMode(raw: unknown): CampaignSenderMode {
  return raw === CAMPAIGN_SENDER_MODE_SELECTED
    ? CAMPAIGN_SENDER_MODE_SELECTED
    : CAMPAIGN_SENDER_MODE_CONTACT_OWNER
}

export function isSelectedCampaignSenderMode(raw: unknown): boolean {
  return parseCampaignSenderMode(raw) === CAMPAIGN_SENDER_MODE_SELECTED
}
