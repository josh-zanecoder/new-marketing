import { describe, expect, it } from 'vitest'
import {
  isCampaignSendTerminalStatus,
  reconcileCampaignSendProgress,
  shouldReleaseInFlightSendUi
} from './reconcileCampaignSendProgress'

describe('isCampaignSendTerminalStatus', () => {
  it('treats Sent and Failed as terminal', () => {
    expect(isCampaignSendTerminalStatus('Sent')).toBe(true)
    expect(isCampaignSendTerminalStatus('Failed')).toBe(true)
    expect(isCampaignSendTerminalStatus('Sending')).toBe(false)
    expect(isCampaignSendTerminalStatus('Scheduled')).toBe(false)
  })
})

describe('reconcileCampaignSendProgress', () => {
  it('prefers recipient ledger when optimistic poll is still Pending', () => {
    const snap = reconcileCampaignSendProgress({
      campaignId: 'c1',
      campaignStatus: 'Sent',
      poll: {
        campaignId: 'c1',
        campaignStatus: 'Sending',
        pending: 2,
        sent: 0,
        failed: 0,
        aborted: 0,
        total: 2,
        done: false
      },
      recipients: [{ status: 'sent' }, { status: 'sent' }]
    })
    expect(snap).toMatchObject({
      campaignId: 'c1',
      campaignStatus: 'Sent',
      pending: 0,
      sent: 2,
      done: true
    })
  })

  it('keeps poll while recipients have not moved ahead', () => {
    const snap = reconcileCampaignSendProgress({
      campaignId: 'c1',
      campaignStatus: 'Sending',
      poll: {
        campaignId: 'c1',
        campaignStatus: 'Sending',
        pending: 1,
        sent: 1,
        failed: 0,
        aborted: 0,
        total: 2,
        done: false
      },
      recipients: [{ status: 'sent' }, { status: 'pending' }]
    })
    expect(snap).toMatchObject({
      pending: 1,
      sent: 1,
      done: false,
      campaignStatus: 'Sending'
    })
  })

  it('uses delivery-report counts when poll lags', () => {
    const snap = reconcileCampaignSendProgress({
      campaignId: 'c1',
      campaignStatus: 'Sending',
      poll: {
        campaignId: 'c1',
        campaignStatus: 'Sending',
        pending: 2,
        sent: 0,
        failed: 0,
        aborted: 0,
        total: 2,
        done: false
      },
      deliveryCounts: {
        pending: 0,
        sending: 0,
        sent: 2,
        failed: 0,
        aborted: 0,
        total: 2,
        remaining: 0
      }
    })
    expect(snap).toMatchObject({
      pending: 0,
      sent: 2,
      done: false
    })
  })
})

describe('shouldReleaseInFlightSendUi', () => {
  it('releases when campaign is terminal and store still tracks the send', () => {
    expect(
      shouldReleaseInFlightSendUi({
        campaignId: 'c1',
        campaignStatus: 'Sent',
        sendingCampaignId: 'c1',
        sendStatusCampaignId: 'c1'
      })
    ).toBe(true)
    expect(
      shouldReleaseInFlightSendUi({
        campaignId: 'c1',
        campaignStatus: 'Sending',
        sendingCampaignId: 'c1',
        sendStatusCampaignId: 'c1'
      })
    ).toBe(false)
  })
})
