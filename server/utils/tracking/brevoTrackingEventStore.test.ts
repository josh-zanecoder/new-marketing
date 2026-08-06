import { describe, expect, it } from 'vitest'
import {
  parseYmdToExactUtcBounds,
  parseYmdToUtcBounds
} from './brevoTrackingEventDateBounds'
import {
  BREVO_SOURCE_DEDUP_TOLERANCE_MS,
  areBrevoTrackingInstantsSame,
  brevoTrackingIdentityFromDate,
  clusterBrevoEventTimestamps,
  parseBrevoEventAtMs,
  preferRicherBrevoEventAtMs
} from './brevoTrackingEventIdentity'
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

  it('maps a Brevo event into a storage doc with exact ms', () => {
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
    expect(doc.eventKeyAt).toBe(Date.parse('2026-08-01T04:44:12.682Z'))
    expect(doc.date).toBe('2026-08-01T04:44:12.682Z')
  })
})

describe('brevoTrackingEventIdentity (accuracy)', () => {
  it('treats webhook offset and API UTC as the same instant within tolerance', () => {
    const webhook = '2026-08-05T17:56:28.034-07:00'
    const api = '2026-08-06T00:56:28.000Z'
    const a = parseBrevoEventAtMs(webhook)!
    const b = parseBrevoEventAtMs(api)!
    expect(Math.abs(a - b)).toBeLessThan(BREVO_SOURCE_DEDUP_TOLERANCE_MS)
    expect(areBrevoTrackingInstantsSame(a, b)).toBe(true)
    expect(preferRicherBrevoEventAtMs(a, b)).toBe(a) // keep .034 webhook ms
  })

  it('does not merge real retries seconds/minutes apart', () => {
    const first = Date.parse('2026-08-06T00:56:28.000Z')
    const retry = first + 30_000
    expect(areBrevoTrackingInstantsSame(first, retry)).toBe(false)
  })

  it('clusters only near-duplicate timestamps', () => {
    const clusters = clusterBrevoEventTimestamps([
      { id: 'webhook', t: Date.parse('2026-08-05T17:56:28.034-07:00') },
      { id: 'api', t: Date.parse('2026-08-06T00:56:28.000Z') },
      { id: 'retry', t: Date.parse('2026-08-06T01:10:00.000Z') }
    ])
    expect(clusters).toHaveLength(2)
    expect(clusters[0]!.sort()).toEqual(['api', 'webhook'])
    expect(clusters[1]).toEqual(['retry'])
  })

  it('maps both sources to proximity-matchable docs (not identical keys)', () => {
    const a = brevoEventToTrackingDoc({
      email: 'cbicknell@barrettfinancial.com',
      date: '2026-08-05T17:56:28.034-07:00',
      messageId: '<202608051742.35179414935.95@smtp-relay.mailin.fr>',
      event: 'clicks',
      from: 'kcampione@myfcltpo.com'
    })
    const b = brevoEventToTrackingDoc({
      email: 'cbicknell@barrettfinancial.com',
      date: '2026-08-06T00:56:28.000Z',
      messageId: '<202608051742.35179414935.95@smtp-relay.mailin.fr>',
      event: 'clicks',
      from: ''
    })
    expect(a.eventKeyAt).not.toBe(b.eventKeyAt) // exact ms differs
    expect(areBrevoTrackingInstantsSame(a.eventKeyAt, b.eventKeyAt)).toBe(true)
    expect(a.messageId).toBe(b.messageId)
    expect(brevoTrackingIdentityFromDate(a.date).eventKeyAt).toBe(a.eventKeyAt)
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

describe('parseYmdToExactUtcBounds', () => {
  it('uses client timezone offset for inclusive local days', () => {
    const bounds = parseYmdToExactUtcBounds('2026-08-01', '2026-08-01', 420)
    expect(bounds).not.toBeNull()
    expect(bounds!.start.toISOString()).toBe('2026-08-01T07:00:00.000Z')
    expect(bounds!.end.toISOString()).toBe('2026-08-02T06:59:59.999Z')
  })
})
