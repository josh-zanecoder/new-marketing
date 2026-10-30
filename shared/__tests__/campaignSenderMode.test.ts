import { describe, expect, it } from 'vitest'
import {
  CAMPAIGN_SENDER_MODE_CONTACT_OWNER,
  CAMPAIGN_SENDER_MODE_SELECTED,
  isSelectedCampaignSenderMode,
  parseCampaignSenderMode
} from '../campaignSenderMode'

describe('campaignSenderMode', () => {
  it('defaults missing/unknown to contact_owner', () => {
    expect(parseCampaignSenderMode(undefined)).toBe(CAMPAIGN_SENDER_MODE_CONTACT_OWNER)
    expect(parseCampaignSenderMode('nope')).toBe(CAMPAIGN_SENDER_MODE_CONTACT_OWNER)
    expect(isSelectedCampaignSenderMode(undefined)).toBe(false)
  })

  it('recognizes selected', () => {
    expect(parseCampaignSenderMode('selected')).toBe(CAMPAIGN_SENDER_MODE_SELECTED)
    expect(isSelectedCampaignSenderMode('selected')).toBe(true)
  })
})
