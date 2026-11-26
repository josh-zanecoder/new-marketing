import { describe, expect, it } from 'vitest'
import {
  categoryTokensFromStatuses,
  MARKETING_STATUS_CATEGORIES,
  marketingStatusCategoryKeyFromToken,
  marketingStatusCategoryOf,
  marketingStatusCategoryRegexSource,
  type MarketingStatusCategoryKey
} from './marketingStatusCategories'

const SAMPLES: Array<[string, MarketingStatusCategoryKey | null]> = [
  ['new_lead', 'new_active_leads'],
  ['New Lead', 'new_active_leads'],
  ['active_lead', 'new_active_leads'],
  ['prospect', 'new_active_leads'],
  ['active_borrower', 'active_borrowers'],
  ['borrower', 'active_borrowers'],
  ['client', 'active_borrowers'],
  ['past_borrower', 'past_clients'],
  ['past_client', 'past_clients'],
  ['closed', 'past_clients'],
  ['inactive_lead', 'inactive_leads'],
  ['dead_lead', 'inactive_leads'],
  ['closed_lost', 'inactive_leads'],
  ['on_hold', 'on_hold'],
  ['lead_on_hold', 'on_hold'],
  ['paused', 'on_hold'],
  ['pre_approved', null],
  ['', null]
]

describe('marketing status categories', () => {
  it('lists the five predefined categories in display order', () => {
    expect(MARKETING_STATUS_CATEGORIES.map((c) => c.label)).toEqual([
      'New & Active Leads',
      'Active Borrowers',
      'Past Clients',
      'Inactive Leads',
      'On Hold'
    ])
  })

  for (const [status, expected] of SAMPLES) {
    it(`"${status}" → ${expected ?? 'uncategorised'}`, () => {
      expect(marketingStatusCategoryOf(status)).toBe(expected)
    })
  }

  it('the Mongo regex agrees with the rule for every sample', () => {
    for (const [status] of SAMPLES) {
      const hits = MARKETING_STATUS_CATEGORIES.filter((c) =>
        new RegExp(marketingStatusCategoryRegexSource(c.key), 'i').test(status.toLowerCase())
      ).map((c) => c.key)
      const expected = marketingStatusCategoryOf(status)
      expect(hits).toEqual(expected ? [expected] : [])
    }
  })

  it('reads category tokens and ignores anything else', () => {
    expect(marketingStatusCategoryKeyFromToken('category:past_clients')).toBe('past_clients')
    expect(marketingStatusCategoryKeyFromToken(' Category:On_Hold ')).toBe('on_hold')
    expect(marketingStatusCategoryKeyFromToken('category:nope')).toBeNull()
    expect(marketingStatusCategoryKeyFromToken('new_lead')).toBeNull()
  })

  it('turns saved raw statuses into category tokens (de-duplicated)', () => {
    expect(
      categoryTokensFromStatuses(['new_lead', 'active_lead', 'category:on_hold', 'pre_approved'])
    ).toEqual(['category:new_active_leads', 'category:on_hold'])
  })
})
