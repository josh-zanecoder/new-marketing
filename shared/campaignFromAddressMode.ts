export const CAMPAIGN_FROM_ADDRESS_MODE_DEFAULT = 'default' as const
export const CAMPAIGN_FROM_ADDRESS_MODE_CONTACT_OWNER = 'contact_owner' as const

export type CampaignFromAddressMode =
  | typeof CAMPAIGN_FROM_ADDRESS_MODE_DEFAULT
  | typeof CAMPAIGN_FROM_ADDRESS_MODE_CONTACT_OWNER

/** Stored on registry `clients.campaignFromAddressMode`. Missing/unknown → default sender. */
export function parseCampaignFromAddressMode(raw: unknown): CampaignFromAddressMode {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase().replace(/-/g, '_') : ''
  if (s === CAMPAIGN_FROM_ADDRESS_MODE_CONTACT_OWNER) {
    return CAMPAIGN_FROM_ADDRESS_MODE_CONTACT_OWNER
  }
  return CAMPAIGN_FROM_ADDRESS_MODE_DEFAULT
}
