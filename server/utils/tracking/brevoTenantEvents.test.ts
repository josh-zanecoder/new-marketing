import { describe, expect, it } from 'vitest'
import {
  extractUserEmailsFromBrevoEvents,
  filterBrevoEventsByDateRange,
  filterBrevoEventsForTenant,
  parseTagSegments,
  type BrevoTrackingEmailEvent
} from './brevoTenantEvents'

describe('filterBrevoEventsForTenant layers', () => {
  const events: BrevoTrackingEmailEvent[] = [
    {
      messageId: 'a',
      event: 'delivered',
      tag: 'tenant:tid-a|db:tenant_a|user:alice@example.com|campaign:507f1f77bcf86cd799439011'
    },
    {
      messageId: 'b',
      event: 'opened',
      tag: 'tenant:tid-a|db:tenant_a|user:bob@example.com|campaign:507f1f77bcf86cd799439011'
    },
    {
      messageId: 'c',
      event: 'delivered',
      tag: 'tenant:tid-a|db:tenant_a|user:alice@example.com|campaign:507f1f77bcf86cd799439012'
    },
    {
      messageId: 'd',
      event: 'delivered',
      tag: 'db:tenant_b|user:alice@example.com|campaign:507f1f77bcf86cd799439011'
    }
  ]

  it('1) keeps only the tenant (db or tenant id)', () => {
    const filtered = filterBrevoEventsForTenant(events, {
      dbName: 'tenant_a',
      marketingTenantId: 'tid-a'
    })
    expect(filtered.map((e) => e.messageId)).toEqual(['a', 'b', 'c'])
  })

  it('2) further narrows by user when not tenant-wide', () => {
    const filtered = filterBrevoEventsForTenant(events, {
      dbName: 'tenant_a',
      marketingTenantId: 'tid-a',
      userEmails: ['alice@example.com']
    })
    expect(filtered.map((e) => e.messageId)).toEqual(['a', 'c'])
  })

  it('3) further narrows by campaign when a campaign is opened', () => {
    const filtered = filterBrevoEventsForTenant(events, {
      dbName: 'tenant_a',
      marketingTenantId: 'tid-a',
      userEmails: ['alice@example.com'],
      campaignId: '507f1f77bcf86cd799439011'
    })
    expect(filtered.map((e) => e.messageId)).toEqual(['a'])
  })

  it('returns no events for an empty user scope', () => {
    const filtered = filterBrevoEventsForTenant(events, {
      dbName: 'tenant_a',
      marketingTenantId: 'tid-a',
      userEmails: []
    })
    expect(filtered).toEqual([])
  })

  it('parseTagSegments accepts comma or pipe separators', () => {
    expect(parseTagSegments('db:x,campaign:y')).toEqual(['db:x', 'campaign:y'])
    expect(parseTagSegments('db:x|campaign:y')).toEqual(['db:x', 'campaign:y'])
  })

  it('extracts distinct email-shaped user tags', () => {
    expect(
      extractUserEmailsFromBrevoEvents([
        { tag: 'user:Alice@Example.com|db:x' },
        { tag: 'user:bob@example.com' },
        { tag: 'user:Alice@Example.com' },
        { tag: 'user:Jane Doe' },
        { tag: 'db:x' }
      ])
    ).toEqual(['alice@example.com', 'bob@example.com'])
  })
})

describe('filterBrevoEventsByDateRange timezone', () => {
  it('keeps a UTC previous-day event that is still "today" in UTC+8', () => {
    // 2026-08-01 00:15 in UTC+8 == 2026-07-31T16:15:00.000Z
    const events: BrevoTrackingEmailEvent[] = [
      { messageId: '1', date: '2026-07-31T16:15:00.000Z', event: 'delivered' }
    ]
    const kept = filterBrevoEventsByDateRange(events, '2026-08-01', '2026-08-01', -480)
    expect(kept.map((e) => e.messageId)).toEqual(['1'])
  })

  it('drops that same event when filtering as UTC "today" Jul 31 only', () => {
    const events: BrevoTrackingEmailEvent[] = [
      { messageId: '1', date: '2026-07-31T16:15:00.000Z', event: 'delivered' }
    ]
    const kept = filterBrevoEventsByDateRange(events, '2026-08-01', '2026-08-01', 0)
    expect(kept).toEqual([])
  })
})
