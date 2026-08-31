import { describe, expect, it } from 'vitest'
import {
  parseZcMailEmailStatusWebhookPayload,
  zcMailWebhookToBrevoBody
} from './parseZcMailEmailStatusWebhookPayload'
import { resolveDbNameFromBrevoTags } from './parseBrevoTransactionalWebhookPayload'

describe('parseZcMailEmailStatusWebhookPayload', () => {
  it('parses email.status with sesMessageId and object tags', () => {
    const parsed = parseZcMailEmailStatusWebhookPayload({
      type: 'email.status',
      event: 'delivered',
      sesMessageId: 'ses-1',
      messageId: 'uuid-1',
      email: 'a@b.com',
      tags: { db: 'tenant_db', tenant: 'tid-1', campaign: 'abc', source: 'new-marketing-campaign' }
    })
    expect(parsed).not.toBeNull()
    expect(parsed!.messageId).toBe('ses-1')
    expect(parsed!.event).toBe('delivered')
    expect(resolveDbNameFromBrevoTags(parsed!.tags)).toBe('tenant_db')
    expect(parsed!.tags).toContain('campaign:abc')
  })

  it('falls back to messageId when sesMessageId missing', () => {
    expect(
      parseZcMailEmailStatusWebhookPayload({
        type: 'email.status',
        event: 'open',
        messageId: 'uuid-1'
      })
    ).toMatchObject({ messageId: 'uuid-1', event: 'opened' })
  })

  it('returns null for invalid payloads', () => {
    expect(parseZcMailEmailStatusWebhookPayload(null)).toBeNull()
    expect(parseZcMailEmailStatusWebhookPayload({ type: 'other' })).toBeNull()
  })

  it('builds a Brevo-shaped body for tracking upsert', () => {
    const body = zcMailWebhookToBrevoBody({
      messageId: 'ses-1',
      event: 'delivered',
      email: 'a@b.com',
      subject: 'Hi',
      from: 'from@x.com',
      date: '2026-08-30T00:00:00.000Z',
      tags: ['db:tenant_db'],
      reason: ''
    })
    expect(body['message-id']).toBe('ses-1')
    expect(body.tags).toEqual(['db:tenant_db'])
  })
})
