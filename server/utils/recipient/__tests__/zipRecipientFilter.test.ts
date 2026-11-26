import { describe, expect, it } from 'vitest'
import { recipientFilterContactFieldPath } from '~~/shared/utils/recipientFilterContactField'
import { recipientFilterPropertyAcceptsValueList } from '~~/shared/utils/recipientFilterPropertyValue'
import { buildContactFilterQuery } from '../recipientListMembershipQuery'

/** Every `address.zip` regex anywhere in a Mongo query tree. */
function zipRegexes(node: unknown, out: RegExp[] = []): RegExp[] {
  if (Array.isArray(node)) {
    for (const child of node) zipRegexes(child, out)
  } else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === 'address.zip' && value && typeof value === 'object' && '$regex' in value) {
        out.push((value as { $regex: RegExp }).$regex)
      } else {
        zipRegexes(value, out)
      }
    }
  }
  return out
}

/** True when a contact ZIP satisfies at least one of the query's address.zip clauses. */
function zipClauseMatches(regexes: RegExp[], zip: string): boolean {
  return regexes.some((re) => re.test(zip))
}

describe('ZIP as an address sub-field of recipient filters', () => {
  it('maps the address/zip pair to the contact ZIP field', () => {
    expect(recipientFilterContactFieldPath('address', 'zip')).toBe('address.zip')
    expect(recipientFilterContactFieldPath('zip', 'none')).toBeNull()
  })

  it('accepts several ZIP codes as one value list, like state', () => {
    expect(recipientFilterPropertyAcceptsValueList('address', 'zip')).toBe(true)
  })

  it('matches one ZIP exactly, not as a prefix or substring', () => {
    const query = buildContactFilterQuery('contact', [{ property: 'zip', value: '78701' }], 'and')
    const regexes = zipRegexes(query)
    expect(regexes.length).toBeGreaterThan(0)
    expect(zipClauseMatches(regexes, '78701')).toBe(true)
    expect(zipClauseMatches(regexes, '787010')).toBe(false)
    expect(zipClauseMatches(regexes, '78702')).toBe(false)
  })

  it('matches any of several ZIPs given on one filter', () => {
    const query = buildContactFilterQuery(
      'contact',
      [
        { property: 'zip', value: '78701' },
        { property: 'zip', value: '78702' }
      ],
      'and'
    )
    const regexes = zipRegexes(query)
    expect(zipClauseMatches(regexes, '78701')).toBe(true)
    expect(zipClauseMatches(regexes, '78702')).toBe(true)
    expect(zipClauseMatches(regexes, '78703')).toBe(false)
  })
})
