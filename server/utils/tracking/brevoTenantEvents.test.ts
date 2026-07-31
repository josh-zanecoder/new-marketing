import { describe, expect, it } from 'vitest'
import {
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
})
