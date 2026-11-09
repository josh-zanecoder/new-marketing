import { describe, expect, it } from 'vitest'
import {
  CAMPAIGN_SCHEDULE_ERROR_INVALID,
  CAMPAIGN_SCHEDULE_ERROR_INVALID_DATE,
  CAMPAIGN_SCHEDULE_ERROR_REQUIRED,
  CAMPAIGN_SCHEDULE_ERROR_STATUS,
  CAMPAIGN_SCHEDULE_ERROR_TOO_SOON,
  CAMPAIGN_SCHEDULE_MIN_LEAD_MS,
  isCampaignScheduleableStatus,
  parseAndValidateCampaignScheduleAt,
  validateCampaignScheduleWhen
} from '../campaignScheduleTime'

describe('campaignScheduleTime', () => {
  const nowMs = Date.UTC(2026, 10, 9, 15, 0, 0)

  it('accepts Draft and Scheduled statuses only', () => {
    expect(isCampaignScheduleableStatus('Draft')).toBe(true)
    expect(isCampaignScheduleableStatus('Scheduled')).toBe(true)
    expect(isCampaignScheduleableStatus('Sending')).toBe(false)
    expect(isCampaignScheduleableStatus('Sent')).toBe(false)
  })

  it('rejects invalid dates', () => {
    const result = validateCampaignScheduleWhen(new Date('not-a-date'), nowMs)
    expect(result).toEqual({ ok: false, message: CAMPAIGN_SCHEDULE_ERROR_INVALID })
  })

  it('rejects past and too-soon times', () => {
    const past = new Date(nowMs - 60_000)
    expect(validateCampaignScheduleWhen(past, nowMs)).toEqual({
      ok: false,
      message: CAMPAIGN_SCHEDULE_ERROR_TOO_SOON
    })

    const almost = new Date(nowMs + CAMPAIGN_SCHEDULE_MIN_LEAD_MS - 1)
    expect(validateCampaignScheduleWhen(almost, nowMs)).toEqual({
      ok: false,
      message: CAMPAIGN_SCHEDULE_ERROR_TOO_SOON
    })
  })

  it('accepts times at least one minute ahead', () => {
    const when = new Date(nowMs + CAMPAIGN_SCHEDULE_MIN_LEAD_MS)
    expect(validateCampaignScheduleWhen(when, nowMs)).toEqual({ ok: true, when })
  })

  it('parses ISO strings with the same lead-time rules', () => {
    expect(parseAndValidateCampaignScheduleAt('', nowMs)).toEqual({
      ok: false,
      message: CAMPAIGN_SCHEDULE_ERROR_REQUIRED
    })
    expect(parseAndValidateCampaignScheduleAt('not-a-date', nowMs)).toEqual({
      ok: false,
      message: CAMPAIGN_SCHEDULE_ERROR_INVALID_DATE
    })

    const okIso = new Date(nowMs + 5 * 60_000).toISOString()
    const parsed = parseAndValidateCampaignScheduleAt(okIso, nowMs)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.when.toISOString()).toBe(okIso)
    }
  })

  it('exports a stable status error for the schedule API', () => {
    expect(CAMPAIGN_SCHEDULE_ERROR_STATUS).toContain('draft or scheduled')
  })
})
