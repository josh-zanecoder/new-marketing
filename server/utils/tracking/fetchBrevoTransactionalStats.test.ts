import { describe, expect, it } from 'vitest'
import {
  clampBrevoSmtpDateRange,
  clampBrevoSmtpStatsRangeToMaxDays
} from './fetchBrevoTransactionalStats'

describe('clampBrevoSmtpDateRange', () => {
  it('clamps endDate to UTC today', () => {
    const now = new Date('2026-08-01T12:00:00.000Z')
    expect(clampBrevoSmtpDateRange('2026-07-25', '2026-08-10', now)).toEqual({
      startDate: '2026-07-25',
      endDate: '2026-08-01'
    })
  })

  it('clamps endDate to the viewer local day', () => {
    const now = new Date('2026-08-30T17:32:00.000Z')
    expect(clampBrevoSmtpDateRange('2026-08-25', '2026-08-31', now, -480)).toEqual({
      startDate: '2026-08-25',
      endDate: '2026-08-31'
    })
  })

  it('pulls start forward when start is after end', () => {
    const now = new Date('2026-08-01T12:00:00.000Z')
    expect(clampBrevoSmtpDateRange('2026-08-05', '2026-08-01', now)).toEqual({
      startDate: '2026-08-01',
      endDate: '2026-08-01'
    })
  })
})

describe('clampBrevoSmtpStatsRangeToMaxDays', () => {
  it('keeps ranges within max days', () => {
    expect(clampBrevoSmtpStatsRangeToMaxDays('2026-07-25', '2026-07-31', 30)).toEqual({
      startDate: '2026-07-25',
      endDate: '2026-07-31'
    })
  })

  it('shortens long ranges from the start', () => {
    expect(clampBrevoSmtpStatsRangeToMaxDays('2026-06-01', '2026-07-31', 30)).toEqual({
      startDate: '2026-07-02',
      endDate: '2026-07-31'
    })
  })
})
