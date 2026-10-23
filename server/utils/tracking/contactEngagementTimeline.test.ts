import { describe, expect, it } from 'vitest'
import { buildContactEngagementTimeline } from './contactEngagementTimeline'

describe('buildContactEngagementTimeline', () => {
  it('orders a send, open, and click newest first and collapses repeat opens', () => {
    const { events, summary } = buildContactEngagementTimeline(
      [
        {
          id: '1',
          event: 'requests',
          eventAt: new Date('2026-10-01T15:00:00.000Z'),
          messageId: 'm1',
          subject: 'Fall rates',
          campaignId: 'c1'
        },
        {
          id: '2',
          event: 'opened',
          eventAt: new Date('2026-10-01T16:00:00.000Z'),
          messageId: 'm1',
          subject: 'Fall rates',
          campaignId: 'c1'
        },
        {
          id: '3',
          event: 'opened',
          eventAt: new Date('2026-10-01T18:00:00.000Z'),
          messageId: 'm1',
          subject: 'Fall rates',
          campaignId: 'c1'
        },
        {
          id: '4',
          event: 'clicks',
          eventAt: new Date('2026-10-01T16:05:00.000Z'),
          messageId: 'm1',
          subject: 'Fall rates',
          campaignId: 'c1',
          link: 'https://example.com/rates'
        }
      ],
      new Map([['c1', 'October rates']])
    )

    expect(events.map((event) => event.kind)).toEqual(['clicked', 'opened', 'sent'])
    expect(events[1]?.at).toBe('2026-10-01T16:00:00.000Z')
    expect(events[1]?.campaignName).toBe('October rates')
    expect(events[0]?.link).toBe('https://example.com/rates')
    expect(summary).toEqual({ sent: 1, delivered: 0, opened: 1, clicked: 1 })
  })

  it('keeps a real open and drops the privacy-proxy copy of the same email', () => {
    const { events } = buildContactEngagementTimeline([
      {
        id: 'p',
        event: 'proxy_opened',
        eventAt: new Date('2026-10-02T12:00:00.000Z'),
        messageId: 'm2',
        subject: 'Hello'
      },
      {
        id: 'o',
        event: 'unique_opened',
        eventAt: new Date('2026-10-02T12:01:00.000Z'),
        messageId: 'm2',
        subject: 'Hello'
      }
    ])
    expect(events).toHaveLength(1)
    expect(events[0]?.kind).toBe('opened')
    expect(events[0]?.at).toBe('2026-10-02T12:01:00.000Z')
  })

  it('records a bounce with its reason', () => {
    const { events } = buildContactEngagementTimeline([
      {
        id: 'b',
        event: 'hardBounces',
        date: '2026-10-03T09:00:00.000Z',
        messageId: 'm3',
        subject: 'Update',
        reason: 'Mailbox full'
      }
    ])
    expect(events[0]?.kind).toBe('bounced')
    expect(events[0]?.label).toBe('Bounced')
    expect(events[0]?.reason).toBe('Mailbox full')
  })
})
