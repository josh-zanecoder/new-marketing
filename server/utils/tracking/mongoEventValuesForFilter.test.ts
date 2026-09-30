import { describe, expect, it } from 'vitest'
import { mongoEventValuesForFilter } from './mongoEventValuesForFilter'
import { metricKeyForEvent } from './aggregateStoredBrevoSmtpStats'

describe('mongoEventValuesForFilter', () => {
  it('returns null when no event type is selected', () => {
    expect(mongoEventValuesForFilter(null)).toBeNull()
    expect(mongoEventValuesForFilter('')).toBeNull()
    expect(mongoEventValuesForFilter('  ')).toBeNull()
  })

  it('maps bounced to hard and soft bounce variants including failed', () => {
    expect(mongoEventValuesForFilter('bounces')).toEqual(
      expect.arrayContaining(['hardBounces', 'softBounces', 'bounces', 'failed'])
    )
  })

  it('maps unique_opened to unique + plain open labels (SES/zcMail store opened)', () => {
    expect(mongoEventValuesForFilter('unique_opened')).toEqual(
      expect.arrayContaining([
        'unique_opened',
        'uniqueopened',
        'firstopening',
        'opened',
        'open',
        'opens'
      ])
    )
    expect(mongoEventValuesForFilter('opened')).toEqual(
      expect.arrayContaining(['opened', 'unique_opened', 'firstopening'])
    )
  })

  it('includes SES/Brevo aliases counted by metricKeyForEvent', () => {
    expect(mongoEventValuesForFilter('requests')).toEqual(
      expect.arrayContaining(['requests', 'sent', 'request', 'send'])
    )
    expect(mongoEventValuesForFilter('delivered')).toEqual(
      expect.arrayContaining(['delivered', 'delivery'])
    )
    expect(mongoEventValuesForFilter('hardBounces')).toEqual(
      expect.arrayContaining(['hardBounces', 'bounces', 'bounce', 'bounced', 'failed'])
    )
    expect(mongoEventValuesForFilter('blocked')).toEqual(
      expect.arrayContaining(['blocked', 'reject'])
    )
    expect(mongoEventValuesForFilter('spam')).toEqual(
      expect.arrayContaining(['spam', 'complaint'])
    )
  })

  it('every label metricKeyForEvent maps to a metric is findable via that metric filter', () => {
    const samples: Array<{ stored: string; filter: string }> = [
      { stored: 'send', filter: 'requests' },
      { stored: 'sent', filter: 'requests' },
      { stored: 'delivery', filter: 'delivered' },
      { stored: 'opened', filter: 'unique_opened' },
      { stored: 'open', filter: 'unique_opened' },
      { stored: 'bounces', filter: 'hardBounces' },
      { stored: 'bounce', filter: 'hardBounces' },
      { stored: 'failed', filter: 'hardBounces' },
      { stored: 'reject', filter: 'blocked' },
      { stored: 'complaint', filter: 'spam' },
      { stored: 'unsubscribe', filter: 'unsubscribed' }
    ]

    for (const { stored, filter } of samples) {
      const metric = metricKeyForEvent(stored)
      expect(metric, stored).not.toBeNull()
      const values = mongoEventValuesForFilter(filter)
      expect(values, `${stored} via ${filter}`).toEqual(
        expect.arrayContaining([stored])
      )
    }
  })
})
