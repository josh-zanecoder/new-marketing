import { describe, expect, it } from 'vitest'
import { readInboundLoanStatusFields } from './inboundLoanStatus'

describe('readInboundLoanStatusFields', () => {
  it('returns {} when the event carries no loan status', () => {
    expect(readInboundLoanStatusFields({ status: 'active_borrower' }, '2026-10-01T00:00:00Z')).toEqual({})
    expect(readInboundLoanStatusFields({ loanStatus: '   ' }, '2026-10-01T00:00:00Z')).toEqual({})
    expect(readInboundLoanStatusFields({ loanStatus: 42 }, '2026-10-01T00:00:00Z')).toEqual({})
  })

  it('keeps the original status and adds a normalized key', () => {
    const out = readInboundLoanStatusFields(
      { loanStatus: ' LQB Loan On-hold ', loanStatusUpdatedAt: '2026-10-05T10:00:00.000Z' },
      '2026-10-01T00:00:00Z'
    )
    expect(out.loanStatus).toBe('LQB Loan On-hold')
    expect(out.loanStatusKey).toBe('loan on hold')
    expect(out.loanStatusUpdatedAt?.toISOString()).toBe('2026-10-05T10:00:00.000Z')
  })

  it('falls back to the event time when loanStatusUpdatedAt is missing or invalid', () => {
    const out = readInboundLoanStatusFields(
      { loanStatus: 'Funded', loanStatusUpdatedAt: 'not-a-date' },
      '2026-10-01T00:00:00.000Z'
    )
    expect(out.loanStatusUpdatedAt?.toISOString()).toBe('2026-10-01T00:00:00.000Z')
  })
})
