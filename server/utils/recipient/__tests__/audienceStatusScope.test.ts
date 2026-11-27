import { describe, expect, it } from 'vitest'
import { audienceStatusClause, withAudienceStatusScope } from '../audienceStatusScope'
import { normalizeLoanOfficerEmails } from '../recipientListService'

describe('withAudienceStatusScope', () => {
  const base = { contactType: 'borrower' }

  it('leaves the query alone when no status is chosen', () => {
    expect(withAudienceStatusScope(base, [])).toBe(base)
    expect(withAudienceStatusScope(base, undefined)).toBe(base)
  })

  it('ANDs a case-insensitive exact status match onto the query', () => {
    const out = withAudienceStatusScope(base, ['past_borrower', 'new_lead']) as {
      $and: [typeof base, { status: { $in: RegExp[] } }]
    }
    expect(out.$and[0]).toBe(base)
    const regexes = out.$and[1].status.$in
    expect(regexes).toHaveLength(2)
    expect(regexes[0]!.test('Past_Borrower')).toBe(true)
    expect(regexes[0]!.test('past_borrower_2')).toBe(false)
    expect(regexes[1]!.test('new_lead')).toBe(true)
  })

  it('escapes regex characters in a status', () => {
    const clause = audienceStatusClause(['a.b'])!
    const rx = (clause.status as { $in: RegExp[] }).$in[0]!
    expect(rx.test('a.b')).toBe(true)
    expect(rx.test('axb')).toBe(false)
  })
})

describe('normalizeLoanOfficerEmails', () => {
  it('lowercases, de-duplicates and drops non-emails', () => {
    expect(
      normalizeLoanOfficerEmails([' Rajeev@Acme.com', 'rajeev@acme.com', 'nope', 'sam@acme.com'])
    ).toEqual(['rajeev@acme.com', 'sam@acme.com'])
  })

  it('returns nothing for non-array input', () => {
    expect(normalizeLoanOfficerEmails('a@b.com')).toEqual([])
    expect(normalizeLoanOfficerEmails(undefined)).toEqual([])
  })
})

describe('audienceStatusClause with the LendingQB toggle', () => {
  it('is unchanged when the toggle is off', () => {
    expect(audienceStatusClause(['category:on_hold'], { lendingQb: false })).toEqual(
      audienceStatusClause(['category:on_hold'])
    )
    expect(audienceStatusClause(['category:on_hold'])).toHaveProperty('status')
  })

  it('matches a category strictly by loanStatusKey list (no fallback to hardcoded status)', () => {
    const clause = audienceStatusClause(['category:on_hold'], { lendingQb: true }) as {
      $or: Array<{ loanStatusKey: { $in: string[] } }>
    }
    const [keyBranch] = clause.$or
    expect(keyBranch!.loanStatusKey.$in).toEqual(
      expect.arrayContaining(['on hold', 'loan on hold', 'suspended', 'loan suspended'])
    )
    expect(keyBranch!.loanStatusKey.$in).not.toContain('funded')
    expect(JSON.stringify(clause)).not.toContain('"status"')
  })

  it('keeps exact status slugs as a plain status branch next to LendingQB categories', () => {
    const clause = audienceStatusClause(['pre_approved', 'category:past_clients'], {
      lendingQb: true
    }) as { $or: Array<Record<string, unknown>> }
    expect(clause.$or).toHaveLength(2)
    const slug = (clause.$or[0] as { status: { $in: RegExp[] } }).status.$in[0]!
    expect(slug.test('pre_approved')).toBe(true)
    expect(slug.test('pre_approved_plus')).toBe(false)
  })

  it('withAudienceStatusScope ANDs the LendingQB clause onto the query', () => {
    const base = { contactType: 'borrower' }
    const out = withAudienceStatusScope(base, ['category:past_clients'], { lendingQb: true }) as {
      $and: unknown[]
    }
    expect(out.$and[0]).toBe(base)
    expect(out.$and[1]).toHaveProperty('$or')
  })
})

describe('audienceStatusClause with marketing categories', () => {
  const matches = (statuses: string[], status: string) => {
    const clause = audienceStatusClause(statuses) as { status: { $in: RegExp[] } }
    return clause.status.$in.some((re) => re.test(status))
  }

  it('matches a category by rule on the contact status', () => {
    expect(matches(['category:new_active_leads'], 'New_Lead')).toBe(true)
    expect(matches(['category:new_active_leads'], 'active_borrower')).toBe(false)
    expect(matches(['category:inactive_leads'], 'inactive_lead')).toBe(true)
    expect(matches(['category:on_hold'], 'on_hold')).toBe(true)
  })

  it('combines categories and still supports exact status slugs', () => {
    expect(matches(['category:past_clients', 'category:on_hold'], 'past_borrower')).toBe(true)
    expect(matches(['category:past_clients', 'category:on_hold'], 'new_lead')).toBe(false)
    expect(matches(['pre_approved'], 'pre_approved')).toBe(true)
    expect(matches(['pre_approved'], 'pre_approved_plus')).toBe(false)
  })
})

