import { describe, expect, it } from 'vitest'
import { parseYmdToExactUtcBounds } from './brevoTrackingEventDateBounds'
import {
  metricKeyForEvent,
  rollupStoredSmtpStatsFromGroups,
  uniqueFunnelIds
} from './aggregateStoredBrevoSmtpStats'

describe('aggregateStoredBrevoSmtpStats date bounds', () => {
  it('builds inclusive local-day UTC bounds for rollups', () => {
    const bounds = parseYmdToExactUtcBounds('2026-08-01', '2026-08-02', 420)
    expect(bounds).not.toBeNull()
    expect(bounds!.start.toISOString()).toBe('2026-08-01T07:00:00.000Z')
    expect(bounds!.end.toISOString()).toBe('2026-08-03T06:59:59.999Z')
  })
})

describe('metricKeyForEvent', () => {
  it('maps Brevo and SES/zcMail labels onto SMTP counters', () => {
    expect(metricKeyForEvent('requests')).toBe('requests')
    expect(metricKeyForEvent('Sent')).toBe('requests')
    expect(metricKeyForEvent('send')).toBe('requests')
    expect(metricKeyForEvent('Delivery')).toBe('delivered')
    expect(metricKeyForEvent('hardBounces')).toBe('hardBounces')
    expect(metricKeyForEvent('bounce')).toBe('hardBounces')
    expect(metricKeyForEvent('failed')).toBe('hardBounces')
  })
})

describe('uniqueFunnelIds', () => {
  it('falls back to messageId|email when messageId is blank', () => {
    expect(
      uniqueFunnelIds({
        _id: { day: '2026-08-31', event: 'requests' },
        count: 3,
        uniqueMessageIds: ['', '  '],
        uniqueKeys: ['|drake@zanecoder.com', '|']
      })
    ).toEqual(['|drake@zanecoder.com'])
  })
})

describe('rollupStoredSmtpStatsFromGroups', () => {
  it('counts emails sent from Sent rows even when messageId is blank', () => {
    const { aggregated } = rollupStoredSmtpStatsFromGroups({
      startDate: '2026-08-25',
      endDate: '2026-08-31',
      rows: [
        {
          _id: { day: '2026-08-31', event: 'requests' },
          count: 3,
          uniqueMessageIds: [''],
          uniqueKeys: ['|drake@zanecoder.com']
        },
        {
          _id: { day: '2026-08-31', event: 'delivered' },
          count: 2,
          uniqueMessageIds: [''],
          uniqueKeys: ['|drake@zanecoder.com']
        },
        {
          _id: { day: '2026-08-31', event: 'hardBounces' },
          count: 2,
          uniqueMessageIds: [''],
          uniqueKeys: ['|drake@zanecoder.com']
        }
      ]
    })
    expect(aggregated.requests).toBe(1)
    expect(aggregated.delivered).toBe(1)
    expect(aggregated.hardBounces).toBe(1)
    expect(aggregated.rates.deliveredPct).toBe(100)
    expect(aggregated.rates.hardBouncesPct).toBe(100)
  })

  it('infers emails sent from delivered/bounce rows when no requests event exists', () => {
    const { aggregated } = rollupStoredSmtpStatsFromGroups({
      startDate: '2026-08-25',
      endDate: '2026-08-31',
      rows: [
        {
          _id: { day: '2026-08-31', event: 'delivered' },
          count: 1,
          uniqueMessageIds: ['arc-1']
        },
        {
          _id: { day: '2026-08-31', event: 'hardBounces' },
          count: 1,
          uniqueMessageIds: ['arc-2']
        }
      ]
    })
    expect(aggregated.requests).toBe(2)
    expect(aggregated.delivered).toBe(1)
    expect(aggregated.hardBounces).toBe(1)
  })

  it('still counts totals when the local day key is empty', () => {
    const { aggregated } = rollupStoredSmtpStatsFromGroups({
      startDate: '2026-08-25',
      endDate: '2026-08-31',
      rows: [
        {
          _id: { day: '', event: 'send' },
          count: 1,
          uniqueMessageIds: ['ses-1']
        }
      ]
    })
    expect(aggregated.requests).toBe(1)
  })

  it('counts distinct message ids across Sent rows as emails sent', () => {
    const { aggregated } = rollupStoredSmtpStatsFromGroups({
      startDate: '2026-08-31',
      endDate: '2026-08-31',
      rows: [
        {
          _id: { day: '2026-08-31', event: 'requests' },
          count: 3,
          uniqueMessageIds: ['a', 'b', 'c']
        }
      ]
    })
    expect(aggregated.requests).toBe(3)
    expect(aggregated.rates.deliveredPct).toBe(0)
  })
})
