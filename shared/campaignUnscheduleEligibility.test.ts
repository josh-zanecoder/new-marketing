import { describe, expect, it } from 'vitest'
import {
  canUnscheduleCampaign,
  decideCampaignUnschedule
} from './campaignUnscheduleEligibility'

describe('canUnscheduleCampaign', () => {
  it('allows Scheduled campaigns', () => {
    expect(
      canUnscheduleCampaign({ status: 'Scheduled', scheduledAt: '2026-11-10T12:00:00.000Z' })
    ).toBe(true)
  })

  it('allows Draft only when a leftover scheduledAt remains', () => {
    expect(canUnscheduleCampaign({ status: 'Draft', scheduledAt: '2026-11-10T12:00:00.000Z' })).toBe(
      true
    )
    expect(canUnscheduleCampaign({ status: 'Draft' })).toBe(false)
  })

  it('hides cancel for Sent and other ineligible statuses', () => {
    expect(canUnscheduleCampaign({ status: 'Sent' })).toBe(false)
    expect(canUnscheduleCampaign({ status: 'Sending' })).toBe(false)
    expect(canUnscheduleCampaign({ status: 'Failed' })).toBe(false)
  })
})

describe('decideCampaignUnschedule', () => {
  it('cancels Scheduled and Draft-with-scheduledAt', () => {
    expect(decideCampaignUnschedule({ status: 'Scheduled' })).toEqual({ action: 'cancel' })
    expect(
      decideCampaignUnschedule({ status: 'Draft', scheduledAt: '2026-11-10T12:00:00.000Z' })
    ).toEqual({ action: 'cancel' })
  })

  it('is idempotent when already Draft without a schedule time', () => {
    expect(decideCampaignUnschedule({ status: 'Draft' })).toEqual({
      action: 'already_cancelled'
    })
  })

  it('rejects Sent with the current status in the message', () => {
    const decided = decideCampaignUnschedule({ status: 'Sent' })
    expect(decided.action).toBe('reject')
    if (decided.action === 'reject') {
      expect(decided.message).toContain('Sent')
    }
  })
})
