import { describe, expect, it } from 'vitest'
import type { BrevoSmtpAggregated } from '@server/utils/tracking/fetchBrevoTransactionalStats'
import { withBrevoSmtpRequestsCount } from './withBrevoSmtpRequestsCount'

function baseAggregated(overrides: Partial<BrevoSmtpAggregated> = {}): BrevoSmtpAggregated {
  return {
    requests: 0,
    delivered: 8,
    hardBounces: 1,
    softBounces: 0,
    opens: 4,
    uniqueOpens: 3,
    clicks: 2,
    uniqueClicks: 2,
    blocked: 0,
    invalid: 0,
    spamReports: 0,
    unsubscribed: 0,
    rates: {
      deliveredPct: 0,
      uniqueOpensPct: 0,
      opensPct: 0,
      uniqueClicksPct: 0,
      hardBouncesPct: 0,
      softBouncesPct: 0,
      blockedPct: 0,
      invalidPct: 0,
      spamReportsPct: 0,
      unsubscribedPct: 0
    },
    ...overrides
  }
}

describe('withBrevoSmtpRequestsCount', () => {
  it('overrides requests and recomputes rates against the new denominator', () => {
    const next = withBrevoSmtpRequestsCount(baseAggregated({ requests: 0 }), 10)
    expect(next.requests).toBe(10)
    expect(next.delivered).toBe(8)
    expect(next.rates.deliveredPct).toBe(80)
    expect(next.rates.uniqueOpensPct).toBe(30)
    expect(next.rates.hardBouncesPct).toBe(10)
  })

  it('keeps zero rates when denominator is zero', () => {
    const next = withBrevoSmtpRequestsCount(baseAggregated({ delivered: 5 }), 0)
    expect(next.requests).toBe(0)
    expect(next.rates.deliveredPct).toBe(0)
  })
})
