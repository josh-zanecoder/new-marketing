import { describe, expect, it } from 'vitest'
import type { BrevoSmtpAggregated, BrevoSmtpDailyRow } from '@server/utils/tracking/fetchBrevoTransactionalStats'
import { rollupAdminAnalytics } from './adminAnalyticsRollup'

function aggregated(partial: Partial<BrevoSmtpAggregated>): BrevoSmtpAggregated {
  return {
    requests: 0,
    delivered: 0,
    hardBounces: 0,
    softBounces: 0,
    opens: 0,
    uniqueOpens: 0,
    clicks: 0,
    uniqueClicks: 0,
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
    ...partial
  }
}

function daily(partial: Partial<BrevoSmtpDailyRow> & { date: string }): BrevoSmtpDailyRow {
  return {
    requests: 0,
    delivered: 0,
    hardBounces: 0,
    softBounces: 0,
    opens: 0,
    uniqueOpens: 0,
    clicks: 0,
    uniqueClicks: 0,
    blocked: 0,
    invalid: 0,
    spamReports: 0,
    unsubscribed: 0,
    ...partial
  }
}

describe('rollupAdminAnalytics', () => {
  it('sums tenant totals and recomputes rates from the combined counts', () => {
    const result = rollupAdminAnalytics([
      {
        aggregated: aggregated({ requests: 10, delivered: 8, uniqueOpens: 4, uniqueClicks: 2 }),
        daily: [daily({ date: '2026-09-01', requests: 10, delivered: 8, uniqueOpens: 4 })]
      },
      {
        aggregated: aggregated({ requests: 10, delivered: 2, uniqueOpens: 1, uniqueClicks: 0 }),
        daily: [daily({ date: '2026-09-01', requests: 10, delivered: 2, uniqueOpens: 1 })]
      }
    ])

    expect(result.summary.emailsSent).toBe(20)
    expect(result.summary.emailsDelivered).toBe(10)
    expect(result.summary.uniqueOpens).toBe(5)
    expect(result.summary.uniqueClicks).toBe(2)
    expect(result.summary.openRate).toBe(50)
    expect(result.timeseries).toEqual([
      expect.objectContaining({
        date: '2026-09-01',
        emailsSent: 20,
        emailsDelivered: 10,
        openRate: 50
      })
    ])
  })
})
