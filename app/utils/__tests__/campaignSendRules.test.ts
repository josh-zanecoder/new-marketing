import { describe, expect, it } from 'vitest'
import type { Campaign } from '~/types/campaign'
import { buildCampaignSendProgress, campaignHasSendAudience } from '../campaignSendRules'

const baseCampaign = (): Campaign => ({
  id: 'c1',
  name: 'Test',
  sender: { name: 'A', email: 'a@example.com' },
  recipientsType: 'list',
  subject: 'Hi',
  status: 'Draft',
  recipients: [],
  createdAt: '',
  updatedAt: ''
})

describe('campaignHasSendAudience', () => {
  it('uses recipientCount for manual campaigns', () => {
    expect(
      campaignHasSendAudience({
        ...baseCampaign(),
        recipientsType: 'manual',
        recipientCount: 3
      })
    ).toBe(true)
  })

  it('allows list drafts with recipientsListId even when count is zero', () => {
    expect(
      campaignHasSendAudience({
        ...baseCampaign(),
        recipientsListId: '507f1f77bcf86cd799439011',
        recipientCount: 0
      })
    ).toBe(true)
  })
})

describe('buildCampaignSendProgress', () => {
  it('includes in-flight sending in processed count and progress pct', () => {
    const progress = buildCampaignSendProgress({
      campaignId: 'c1',
      campaignStatus: 'Sending',
      pending: 10000,
      sent: 500,
      sending: 4500,
      failed: 1,
      total: 15001,
      done: false
    })

    expect(progress).toMatchObject({
      sent: 500,
      sending: 4500,
      inFlight: 4500,
      remaining: 10000,
      processed: 5001,
      pct: (5001 / 15001) * 100
    })
  })

  it('returns null when campaignId filter does not match', () => {
    expect(
      buildCampaignSendProgress(
        {
          campaignId: 'other',
          campaignStatus: 'Sending',
          pending: 1,
          sent: 0,
          failed: 0,
          total: 1,
          done: false
        },
        'c1'
      )
    ).toBeNull()
  })
})
