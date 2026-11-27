import { describe, expect, it } from 'vitest'
import {
  CONTACT_EVENT_TYPES,
  parseContactUnsubscribedEventEnvelope
} from './contactEvents'

describe('parseContactUnsubscribedEventEnvelope', () => {
  it('accepts a ratesheet bounce unsubscribe envelope', () => {
    const parsed = parseContactUnsubscribedEventEnvelope({
      eventType: CONTACT_EVENT_TYPES.UNSUBSCRIBED,
      occurredAt: '2026-11-19T12:00:00.000Z',
      dBname: 'marketing_acme',
      tenantId: 'tenant-uuid',
      payload: {
        email: 'bounce@example.com',
        tenantId: 'tenant-uuid',
        dBname: 'marketing_acme',
        reason: 'ratesheet_bounce',
        source: 'mortdash-crm-ratesheet',
        event: 'soft_bounce',
        messageId: 'mid-1'
      }
    })
    expect(parsed?.payload.email).toBe('bounce@example.com')
    expect(parsed?.payload.reason).toBe('ratesheet_bounce')
  })

  it('rejects envelopes without email', () => {
    expect(
      parseContactUnsubscribedEventEnvelope({
        eventType: CONTACT_EVENT_TYPES.UNSUBSCRIBED,
        occurredAt: '2026-11-19T12:00:00.000Z',
        dBname: 'marketing_acme',
        tenantId: 'tenant-uuid',
        payload: {
          email: '   ',
          tenantId: 'tenant-uuid',
          dBname: 'marketing_acme'
        }
      })
    ).toBeNull()
  })
})
