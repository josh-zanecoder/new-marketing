import { describe, expect, it } from 'vitest'
import {
  isActiveRecipientListMemberSearch,
  normalizeRecipientListMemberSearchQ,
  recipientListMemberSearchOrClauses
} from './recipientListMemberSearch'

describe('recipientListMemberSearch (LO-list flag detail search)', () => {
  it('normalizes and activates only from 2+ chars', () => {
    expect(normalizeRecipientListMemberSearchQ('  ab  ')).toBe('ab')
    expect(isActiveRecipientListMemberSearch('')).toBe(false)
    expect(isActiveRecipientListMemberSearch('a')).toBe(false)
    expect(isActiveRecipientListMemberSearch('ab')).toBe(true)
  })

  it('builds name/email $or clauses', () => {
    const clauses = recipientListMemberSearchOrClauses('rod')
    expect(clauses).toHaveLength(4)
    expect(clauses[0]).toEqual({ email: { $regex: 'rod', $options: 'i' } })
    expect(clauses.map((c) => Object.keys(c)[0]).sort()).toEqual([
      'email',
      'firstName',
      'lastName',
      'name'
    ])
  })

  it('escapes regex metacharacters in the query', () => {
    const clauses = recipientListMemberSearchOrClauses('a+b')
    expect((clauses[0] as { email: { $regex: string } }).email.$regex).toBe('a\\+b')
  })
})
