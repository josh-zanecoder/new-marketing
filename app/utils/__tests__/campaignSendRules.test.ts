import { describe, expect, it } from 'vitest'
import { buildCampaignSendProgress } from '../campaignSendRules'

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
