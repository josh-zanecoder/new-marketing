import { describe, expect, it } from 'node:test'
import { computeMarketingAnalytics } from '../computeMarketingAnalytics'
import type { BrevoTrackingEmailEvent } from '../brevoTenantEvents'

describe('computeMarketingAnalytics', () => {
  it('aggregates summary counts and rates from Brevo events', () => {
    const events: BrevoTrackingEmailEvent[] = [
      { messageId: 'a', date: '2026-06-10T10:00:00.000Z', event: 'requests' },
      { messageId: 'a', date: '2026-06-10T10:05:00.000Z', event: 'delivered' },
      { messageId: 'a', date: '2026-06-10T11:00:00.000Z', event: 'unique_opened' },
      { messageId: 'b', date: '2026-06-11T09:00:00.000Z', event: 'requests' },
      { messageId: 'b', date: '2026-06-11T09:05:00.000Z', event: 'delivered' },
      { messageId: 'b', date: '2026-06-11T09:10:00.000Z', event: 'click' },
      { messageId: 'c', date: '2026-06-11T12:00:00.000Z', event: 'requests' },
      { messageId: 'c', date: '2026-06-11T12:01:00.000Z', event: 'hard_bounces' }
    ]

    const result = computeMarketingAnalytics(events, '2026-06-10', '2026-06-11')

    expect(result.summary.emailsSent).toBe(3)
    expect(result.summary.emailsDelivered).toBe(2)
    expect(result.summary.uniqueOpens).toBe(1)
    expect(result.summary.uniqueClicks).toBe(1)
    expect(result.summary.bounces).toBe(1)
    expect(result.summary.openRate).toBe(50)
    expect(result.summary.clickRate).toBe(50)
    expect(result.summary.bounceRate).toBeCloseTo(33.333, 2)
    expect(result.timeseries).toHaveLength(2)
    expect(result.timeseries[0]?.emailsSent).toBe(1)
    expect(result.timeseries[1]?.emailsDelivered).toBe(2)
  })
})
