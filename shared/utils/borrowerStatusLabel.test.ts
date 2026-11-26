import { describe, expect, it } from 'vitest'
import { borrowerStatusLabel, normalizeAudienceStatuses } from './borrowerStatusLabel'

describe('borrowerStatusLabel', () => {
  it('turns retail-origination slugs into the configured label', () => {
    expect(borrowerStatusLabel('new_lead')).toBe('New Lead')
    expect(borrowerStatusLabel('active_borrower')).toBe('Active Borrower')
    expect(borrowerStatusLabel('past_borrower')).toBe('Past Borrower')
    expect(borrowerStatusLabel('on_hold')).toBe('On Hold')
  })

  it('handles odd casing and empty input', () => {
    expect(borrowerStatusLabel('  ACTIVE_BORROWER ')).toBe('Active Borrower')
    expect(borrowerStatusLabel('inactive-lead')).toBe('Inactive Lead')
    expect(borrowerStatusLabel('')).toBe('')
    expect(borrowerStatusLabel(undefined)).toBe('')
  })
})

describe('normalizeAudienceStatuses', () => {
  it('lowercases, trims and de-duplicates', () => {
    expect(normalizeAudienceStatuses([' Past_Borrower', 'past_borrower', 'new_lead', ''])).toEqual([
      'past_borrower',
      'new_lead'
    ])
  })

  it('accepts a comma list and ignores junk', () => {
    expect(normalizeAudienceStatuses('a, b ,a')).toEqual(['a', 'b'])
    expect(normalizeAudienceStatuses(42)).toEqual([])
    expect(normalizeAudienceStatuses([1, null, {}])).toEqual([])
  })

  it('caps the list', () => {
    const many = Array.from({ length: 80 }, (_, i) => `s${i}`)
    expect(normalizeAudienceStatuses(many, 50)).toHaveLength(50)
  })
})
