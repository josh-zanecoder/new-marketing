import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { filterBrevoEventsForTenant, parseTagSegments } from '../brevoTenantEvents'
import type { BrevoTrackingEmailEvent } from '../brevoTenantEvents'

describe('filterBrevoEventsForTenant', () => {
  const events: BrevoTrackingEmailEvent[] = [
    { messageId: 'a', event: 'delivered', tag: 'db:tenant_a,campaign:507f1f77bcf86cd799439011' },
    { messageId: 'b', event: 'delivered', tag: 'db:tenant_a,campaign:507f1f77bcf86cd799439012' },
    { messageId: 'c', event: 'delivered', tag: 'db:tenant_b,campaign:507f1f77bcf86cd799439011' },
    { messageId: 'd', event: 'delivered', tag: 'tenant:tid-a,campaign:507f1f77bcf86cd799439011' },
    {
      messageId: 'e',
      event: 'delivered',
      tag: 'tenant:tid-a|db:tenant_a|user:ops@example.com|campaign:507f1f77bcf86cd799439011'
    }
  ]

  it('keeps only events for the tenant db or tenant id', () => {
    const filtered = filterBrevoEventsForTenant(events, 'tenant_a', 'tid-a', null)
    assert.equal(filtered.length, 4)
    assert.deepEqual(
      filtered.map((e) => e.messageId),
      ['a', 'b', 'd', 'e']
    )
  })

  it('narrows to a single campaign when campaignId is set', () => {
    const filtered = filterBrevoEventsForTenant(
      events,
      'tenant_a',
      'tid-a',
      '507f1f77bcf86cd799439011'
    )
    assert.equal(filtered.length, 3)
    assert.deepEqual(
      filtered.map((e) => e.messageId),
      ['a', 'd', 'e']
    )
  })

  it('narrows by user when userEmails are provided', () => {
    const filtered = filterBrevoEventsForTenant(events, {
      dbName: 'tenant_a',
      marketingTenantId: 'tid-a',
      userEmails: ['ops@example.com']
    })
    assert.deepEqual(
      filtered.map((e) => e.messageId),
      ['e']
    )
  })

  it('parseTagSegments accepts comma or pipe separators', () => {
    assert.deepEqual(parseTagSegments('db:x,campaign:y'), ['db:x', 'campaign:y'])
    assert.deepEqual(parseTagSegments('db:x|campaign:y'), ['db:x', 'campaign:y'])
  })
})
