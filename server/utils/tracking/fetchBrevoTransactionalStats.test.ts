import { describe, expect, it } from 'vitest'
import { clampBrevoSmtpDateRange } from './fetchBrevoTransactionalStats'

describe('clampBrevoSmtpDateRange', () => {
  it('clamps endDate to UTC today', () => {
    const now = new Date('2026-08-02T12:00:00.000Z')
    expect(clampBrevoSmtpDateRange('2026-07-25', '2026-08-10', now)).toEqual({
      startDate: '2026-07-25',
      endDate: '2026-08-02'
    })
  })

  it('pulls start forward when after end', () => {
    const now = new Date('2026-08-02T12:00:00.000Z')
    expect(clampBrevoSmtpDateRange('2026-08-05', '2026-08-01', now)).toEqual({
      startDate: '2026-08-01',
      endDate: '2026-08-01'
    })
  })
})
