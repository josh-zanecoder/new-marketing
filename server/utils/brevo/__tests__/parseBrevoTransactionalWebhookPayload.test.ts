import { describe, expect, it } from 'vitest'
import { parseBrevoTransactionalWebhookPayload } from '../parseBrevoTransactionalWebhookPayload'
import { brevoMessageIdVariants } from '../brevoMessageIdVariants'

describe('parseBrevoTransactionalWebhookPayload', () => {
  it('parses flat delivered payload', () => {
    const parsed = parseBrevoTransactionalWebhookPayload({
      event: 'delivered',
      email: 'User@Example.com',
      'message-id': '<abc123@brevo>',
      date: '2026-06-04T12:00:00.000Z'
    })
    expect(parsed).toEqual({
      messageId: '<abc123@brevo>',
      event: 'delivered',
      email: 'user@example.com',
      occurredAt: new Date('2026-06-04T12:00:00.000Z')
    })
  })

  it('parses nested item payload with failure reason', () => {
    const parsed = parseBrevoTransactionalWebhookPayload({
      item: {
        event: 'hard_bounce',
        email: 'bad@example.com',
        messageId: 'msg-99',
        date: '2026-06-04T12:05:00.000Z',
        reason: 'Mailbox not found',
        tag: 'campaign:507f1f77bcf86cd799439011,db:tenant_db'
      }
    })
    expect(parsed?.event).toBe('hard_bounce')
    expect(parsed?.reason).toBe('Mailbox not found')
    expect(parsed?.tag).toContain('campaign:')
  })

  it('returns null without message id', () => {
    expect(parseBrevoTransactionalWebhookPayload({ event: 'opened' })).toBeNull()
  })
})

describe('brevoMessageIdVariants', () => {
  it('includes bracketed and plain ids', () => {
    expect(brevoMessageIdVariants('<abc@x>')).toEqual(expect.arrayContaining(['<abc@x>', 'abc@x']))
  })
})
