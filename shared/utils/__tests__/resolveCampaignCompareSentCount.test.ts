import { describe, expect, it } from 'vitest'
import { resolveCampaignCompareSentCount } from '../resolveCampaignCompareSentCount'

describe('resolveCampaignCompareSentCount', () => {
  it('prefers CampaignRecipient sent when present', () => {
    expect(
      resolveCampaignCompareSentCount({ recipientSent: 12, smtpRequests: 9 })
    ).toBe(12)
  })

  it('falls back to SMTP requests when recipient ledger has no sent rows', () => {
    expect(
      resolveCampaignCompareSentCount({ recipientSent: 0, smtpRequests: 40 })
    ).toBe(40)
  })

  it('returns 0 when both sources are empty', () => {
    expect(
      resolveCampaignCompareSentCount({ recipientSent: 0, smtpRequests: 0 })
    ).toBe(0)
  })

  it('floors and clamps invalid numbers', () => {
    expect(
      resolveCampaignCompareSentCount({
        recipientSent: 3.9 as number,
        smtpRequests: -5
      })
    ).toBe(3)
    expect(
      resolveCampaignCompareSentCount({
        recipientSent: Number.NaN,
        smtpRequests: 8.2 as number
      })
    ).toBe(8)
  })
})
