import { describe, expect, it } from 'vitest'
import {
  normalizeBrevoWebhookEventName,
  parseBrevoTransactionalWebhookPayload,
  resolveDbNameFromBrevoTags,
  resolveTenantIdFromBrevoTags
} from './parseBrevoTransactionalWebhookPayload'

describe('parseBrevoTransactionalWebhookPayload', () => {
  it('parses a delivered webhook and maps tags', () => {
    const parsed = parseBrevoTransactionalWebhookPayload({
      event: 'delivered',
      email: 'drake@zanecoder.com',
      date: '2026-08-01 00:15:00',
      ts_event: 1754007300,
      'message-id': '202607311615.96593592992@smtp-relay.mailin.fr',
      subject: 'Hello',
      tags: [
        'tenant:tid-1',
        'db:forge_capital_lending_db',
        'user:ops@example.com',
        'campaign:6a6cc9c694cfdfdb1fb29cab'
      ]
    })

    expect(parsed).not.toBeNull()
    expect(parsed!.event).toBe('delivered')
    expect(parsed!.messageId).toBe('<202607311615.96593592992@smtp-relay.mailin.fr>')
    expect(parsed!.email).toBe('drake@zanecoder.com')
    expect(parsed!.subject).toBe('Hello')
    expect(parsed!.date).toBe(new Date(1754007300 * 1000).toISOString())
    expect(resolveDbNameFromBrevoTags(parsed!.tags)).toBe('forge_capital_lending_db')
    expect(resolveTenantIdFromBrevoTags(parsed!.tags)).toBe('tid-1')
  })

  it('normalizes request → requests and bounce variants', () => {
    expect(normalizeBrevoWebhookEventName('request')).toBe('requests')
    expect(normalizeBrevoWebhookEventName('soft_bounce')).toBe('softBounces')
    expect(normalizeBrevoWebhookEventName('hard_bounce')).toBe('hardBounces')
    expect(normalizeBrevoWebhookEventName('click')).toBe('clicks')
    expect(normalizeBrevoWebhookEventName('unique_opened')).toBe('unique_opened')
  })

  it('returns null without message id', () => {
    expect(
      parseBrevoTransactionalWebhookPayload({
        event: 'delivered',
        email: 'a@b.com'
      })
    ).toBeNull()
  })

  it('parses tag JSON string arrays', () => {
    const parsed = parseBrevoTransactionalWebhookPayload({
      event: 'opened',
      'message-id': '<mid@x.com>',
      tag: '["db:tenant_a","campaign:abc"]',
      ts: 1754007300
    })
    expect(parsed).not.toBeNull()
    expect(resolveDbNameFromBrevoTags(parsed!.tags)).toBe('tenant_a')
  })
})
