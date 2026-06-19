import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { filterBrevoEventsForTenant } from '../brevoTenantEvents'
import type { BrevoTrackingEmailEvent } from '../brevoTenantEvents'

describe('filterBrevoEventsForTenant', () => {
  const events: BrevoTrackingEmailEvent[] = [
    { messageId: 'a', event: 'delivered', tag: 'db:tenant_a,campaign:507f1f77bcf86cd799439011' },
    { messageId: 'b', event: 'delivered', tag: 'db:tenant_a,campaign:507f1f77bcf86cd799439012' },
    { messageId: 'c', event: 'delivered', tag: 'db:tenant_b,campaign:507f1f77bcf86cd799439011' },
    { messageId: 'd', event: 'delivered', tag: 'tenant:tid-a,campaign:507f1f77bcf86cd799439011' }
  ]

  it('keeps only events for the tenant db or tenant id', () => {
    const filtered = filterBrevoEventsForTenant(events, 'tenant_a', 'tid-a', null)
    assert.equal(filtered.length, 3)
    assert.deepEqual(
      filtered.map((e) => e.messageId),
      ['a', 'b', 'd']
    )
  })

  it('narrows to a single campaign when campaignId is set', () => {
    const filtered = filterBrevoEventsForTenant(
      events,
      'tenant_a',
      'tid-a',
      '507f1f77bcf86cd799439011'
    )
    assert.equal(filtered.length, 2)
    assert.deepEqual(
      filtered.map((e) => e.messageId),
      ['a', 'd']
    )
  })
})
