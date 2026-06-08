import { describe, expect, it } from 'vitest'
import {
  buildRecipientStatusCountsMap,
  finalizeRecipientStatusCounts
} from '../recipientStatusCounts'
import {
  CAMPAIGN_RECIPIENT_STATUS_CANCELLED,
  CAMPAIGN_RECIPIENT_STATUS_FAILED,
  CAMPAIGN_RECIPIENT_STATUS_PENDING,
  CAMPAIGN_RECIPIENT_STATUS_SENDING,
  CAMPAIGN_RECIPIENT_STATUS_SENT
} from '../constants'

const CAMPAIGN_A = '507f1f77bcf86cd799439011'
const CAMPAIGN_B = '507f1f77bcf86cd799439012'

describe('finalizeRecipientStatusCounts', () => {
  it('derives notSent and total from status buckets', () => {
    expect(
      finalizeRecipientStatusCounts({
        sent: 10,
        pending: 3,
        sending: 2,
        failed: 1,
        cancelled: 4
      })
    ).toEqual({
      sent: 10,
      pending: 3,
      sending: 2,
      failed: 1,
      cancelled: 4,
      notSent: 10,
      total: 20
    })
  })
})

describe('buildRecipientStatusCountsMap', () => {
  it('groups rows per campaign and pre-seeds empty campaigns', () => {
    const map = buildRecipientStatusCountsMap(
      [CAMPAIGN_A, CAMPAIGN_B],
      [
        { campaignId: CAMPAIGN_A, status: CAMPAIGN_RECIPIENT_STATUS_SENT, count: 5 },
        { campaignId: CAMPAIGN_A, status: CAMPAIGN_RECIPIENT_STATUS_PENDING, count: 2 },
        { campaignId: CAMPAIGN_A, status: CAMPAIGN_RECIPIENT_STATUS_SENDING, count: 1 },
        { campaignId: CAMPAIGN_B, status: CAMPAIGN_RECIPIENT_STATUS_FAILED, count: 3 }
      ]
    )

    expect(map.get(CAMPAIGN_A)).toEqual({
      sent: 5,
      pending: 2,
      sending: 1,
      failed: 0,
      cancelled: 0,
      notSent: 3,
      total: 8
    })
    expect(map.get(CAMPAIGN_B)).toEqual({
      sent: 0,
      pending: 0,
      sending: 0,
      failed: 3,
      cancelled: 0,
      notSent: 3,
      total: 3
    })
  })

  it('includes cancelled recipients in notSent', () => {
    const map = buildRecipientStatusCountsMap([CAMPAIGN_A], [
      { campaignId: CAMPAIGN_A, status: CAMPAIGN_RECIPIENT_STATUS_CANCELLED, count: 7 }
    ])
    expect(map.get(CAMPAIGN_A)?.cancelled).toBe(7)
    expect(map.get(CAMPAIGN_A)?.notSent).toBe(7)
  })
})
