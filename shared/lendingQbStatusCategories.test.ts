import { describe, expect, it } from 'vitest'
import {
  lendingQbCategoryOf,
  lendingQbStatusKeysForCategory,
  normalizeLendingQbStatus
} from './lendingQbStatusCategories'

describe('normalizeLendingQbStatus', () => {
  it('lowercases, collapses separators and drops the LQB/LOB/QB prefix', () => {
    expect(normalizeLendingQbStatus('LQB Pre-Processing')).toBe('pre processing')
    expect(normalizeLendingQbStatus('  Loan   On-hold ')).toBe('loan on hold')
    expect(normalizeLendingQbStatus('LOB Pre-Qual')).toBe('pre qual')
    expect(normalizeLendingQbStatus('QB Loan Open')).toBe('loan open')
    expect(normalizeLendingQbStatus('lqb_clear_to_close')).toBe('clear to close')
  })

  it('returns empty for non-strings and keeps a lone prefix word', () => {
    expect(normalizeLendingQbStatus(undefined)).toBe('')
    expect(normalizeLendingQbStatus(12)).toBe('')
    expect(normalizeLendingQbStatus('LQB')).toBe('lqb')
  })
})

describe('lendingQbCategoryOf (requirements document lists)', () => {
  const cases: Array<[string, string[]]> = [
    [
      'new_active_leads',
      ['New Lead', 'Attempting Contact', 'Contacted', 'LOB Pre-Qual', 'LQB Pre-approved']
    ],
    [
      'active_borrowers',
      [
        'QB Loan Open',
        'LQB Pre-Processing',
        'LQB Processing',
        'LQB Loan Submitted',
        'LQB In Underwriting',
        'LQB Approved',
        'LQB Final Underwriting',
        'LQB Clear to Close',
        'LQB Docs Out',
        'LQB Docs Back',
        'LQB Funding Conditions',
        'LQB Final Docs',
        'LQB Funding'
      ]
    ],
    [
      'past_clients',
      ['LQB Funded', 'LQB Loan Shipped', 'LQB Loan Sold', 'LQB Recorded', 'LQB Loan Closed']
    ],
    [
      'inactive_leads',
      ['Not interested', 'Did Not Quality', 'LQB Loan Denied', 'LOB Loan Canceled']
    ],
    ['on_hold', ['LQB Loan Suspended', 'LQB Loan On-hold']]
  ]

  for (const [category, statuses] of cases) {
    for (const status of statuses) {
      it(`${status} -> ${category}`, () => {
        expect(lendingQbCategoryOf(status)).toBe(category)
      })
    }
  }
})

describe('lendingQbCategoryOf (native LendingQB spellings)', () => {
  it('treats the "Loan " prefix as optional', () => {
    expect(lendingQbCategoryOf('Loan Funded')).toBe('past_clients')
    expect(lendingQbCategoryOf('Funded')).toBe('past_clients')
    expect(lendingQbCategoryOf('Loan Approved')).toBe('active_borrowers')
    expect(lendingQbCategoryOf('Loan Clear To Close')).toBe('active_borrowers')
    expect(lendingQbCategoryOf('Loan DocsBack')).toBe('active_borrowers')
    expect(lendingQbCategoryOf('Loan Pre Processing')).toBe('active_borrowers')
    expect(lendingQbCategoryOf('Loan Underwriting')).toBe('active_borrowers')
    expect(lendingQbCategoryOf('Loan On Hold')).toBe('on_hold')
    expect(lendingQbCategoryOf('Loan Canceled')).toBe('inactive_leads')
    expect(lendingQbCategoryOf('Lead New')).toBe('new_active_leads')
    expect(lendingQbCategoryOf('Loan Prequal')).toBe('new_active_leads')
    expect(lendingQbCategoryOf('Loan Preapproval')).toBe('new_active_leads')
    expect(lendingQbCategoryOf('Pre-approved')).toBe('new_active_leads')
  })

  it('is case-insensitive', () => {
    expect(lendingQbCategoryOf('LOAN FUNDED')).toBe('past_clients')
    expect(lendingQbCategoryOf('clear to close')).toBe('active_borrowers')
  })
})

describe('lendingQbCategoryOf (unmapped / unclear)', () => {
  it('leaves statuses that need clarification uncategorized', () => {
    expect(lendingQbCategoryOf('Legacy Record')).toBeNull()
    expect(lendingQbCategoryOf('LQB Loan Archived')).toBeNull()
    expect(lendingQbCategoryOf('Loan Archived')).toBeNull()
    expect(lendingQbCategoryOf('LQB Loan')).toBeNull()
    expect(lendingQbCategoryOf('Loan')).toBeNull()
  })

  it('does not guess for unknown statuses or empty input', () => {
    expect(lendingQbCategoryOf('Loan Docs')).toBeNull()
    expect(lendingQbCategoryOf('Lead Declined')).toBeNull()
    expect(lendingQbCategoryOf('')).toBeNull()
    expect(lendingQbCategoryOf(null)).toBeNull()
  })
})

describe('lendingQbStatusKeysForCategory', () => {
  it('returns normalized keys incl. loan variants and no overlaps between categories', () => {
    const past = lendingQbStatusKeysForCategory('past_clients')
    expect(past).toEqual(expect.arrayContaining(['funded', 'loan funded', 'shipped', 'loan shipped']))
    const seen = new Set<string>()
    for (const cat of [
      'new_active_leads',
      'active_borrowers',
      'past_clients',
      'inactive_leads',
      'on_hold'
    ] as const) {
      for (const key of lendingQbStatusKeysForCategory(cat)) {
        expect(seen.has(key)).toBe(false)
        seen.add(key)
      }
    }
    expect(seen.has('loan')).toBe(false)
  })
})
