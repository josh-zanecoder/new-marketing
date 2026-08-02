import { describe, expect, it } from 'vitest'
import { parseYmdToUtcBounds } from './brevoTrackingEventDateBounds'
import {
  brevoEventToTrackingDoc,
  parseCampaignIdFromBrevoTag,
  parseUserEmailFromBrevoTag
} from './syncTenantBrevoTrackingEvents'

describe('brevo tracking event tag parsers', () => {
  it('parses campaign and user from pipe tags', () => {
    const tag =
      'tenant:tid|db:cbc_crm_db|user:campuscrush143@gmail.com|campaign:6a6cc9c694cfdfdb1fb29cab'
    expect(parseCampaignIdFromBrevoTag(tag)).toBe('6a6cc9c694cfdfdb1fb29cab')
    expect(parseUserEmailFromBrevoTag(tag)).toBe('campuscrush143@gmail.com')
  })

  it('maps a Brevo event into a storage doc', () => {
    const doc = brevoEventToTrackingDoc({
      email: 'a@b.com',
      date: '2026-08-01T04:44:12.682Z',
      messageId: '<mid>',
      event: 'requests',
      tag: 'db:x|user:ops@example.com|campaign:6a6cc9c694cfdfdb1fb29cab'
    })
    expect(doc.messageId).toBe('<mid>')
    expect(doc.event).toBe('requests')
    expect(doc.campaignId).toBe('6a6cc9c694cfdfdb1fb29cab')
    expect(doc.userEmail).toBe('ops@example.com')
    expect(doc.eventAt).toBeInstanceOf(Date)
  })
})

describe('parseYmdToUtcBounds', () => {
  it('pads the range by one day', () => {
    const bounds = parseYmdToUtcBounds('2026-08-01', '2026-08-01', null)
    expect(bounds).not.toBeNull()
    expect(bounds!.start.toISOString().startsWith('2026-07-31')).toBe(true)
    expect(bounds!.end.getUTCDate()).toBe(2)
  })
})
