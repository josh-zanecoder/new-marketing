import { describe, expect, it } from 'vitest'
import {
  countCampaignRecipientDeliveryStatuses,
  sendStatusFromCampaignRecipients
} from './campaignRecipientDeliveryCounts'

describe('countCampaignRecipientDeliveryStatuses', () => {
  it('counts sending separately so Pending is not stuck at 0', () => {
    const counts = countCampaignRecipientDeliveryStatuses([
      { status: 'sending' },
      { status: 'sending' },
      { status: 'pending' },
      { status: 'sent' },
      { status: 'failed' }
    ])
    expect(counts).toEqual({
      pending: 1,
      sending: 2,
      sent: 1,
      failed: 1,
      aborted: 0,
      total: 5,
      remaining: 3
    })
  })

  it('returns zeros for empty input', () => {
    expect(countCampaignRecipientDeliveryStatuses([])).toEqual({
      pending: 0,
      sending: 0,
      sent: 0,
      failed: 0,
      aborted: 0,
      total: 0,
      remaining: 0
    })
  })
})

describe('sendStatusFromCampaignRecipients', () => {
  it('builds poll-shaped progress while campaign is Sending', () => {
    const snap = sendStatusFromCampaignRecipients({
      campaignId: 'c1',
      campaignStatus: 'Sending',
      recipients: [{ status: 'sending' }, { status: 'sending' }]
    })
    expect(snap).toEqual({
      campaignId: 'c1',
      campaignStatus: 'Sending',
      pending: 2,
      sent: 0,
      failed: 0,
      aborted: 0,
      total: 2,
      done: false
    })
  })

  it('marks done when no remaining work and status is final', () => {
    const snap = sendStatusFromCampaignRecipients({
      campaignId: 'c1',
      campaignStatus: 'Sent',
      recipients: [{ status: 'sent' }, { status: 'sent' }]
    })
    expect(snap.done).toBe(true)
    expect(snap.pending).toBe(0)
    expect(snap.sent).toBe(2)
  })
})
