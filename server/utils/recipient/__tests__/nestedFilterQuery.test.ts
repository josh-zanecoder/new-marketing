import { describe, expect, it } from 'vitest'
import {
  buildContactFilterQuery,
  buildNestedFilterQuery
} from '../recipientListMembershipQuery'

const leaf = (property: string, value: string) => [{ property, value }]

describe('buildNestedFilterQuery', () => {
  it('keeps (1 OR 2) AND (a OR b) as two groups', () => {
    const query = buildNestedFilterQuery(
      'contact',
      [
        { rowGroups: [leaf('state', 'TX'), leaf('state', 'CA')], joins: ['or'] },
        { rowGroups: [leaf('channel', 'email'), leaf('channel', 'sms')], joins: ['or'] }
      ],
      ['and']
    )
    expect(query.contactType).toBe('contact')
    const groups = query.$and as { $or: unknown[] }[]
    expect(groups).toHaveLength(2)
    expect(groups[0]?.$or).toHaveLength(2)
    expect(groups[1]?.$or).toHaveLength(2)
  })

  it('does not match a flat left-associative chain of the same rows', () => {
    const flat = buildContactFilterQuery(
      'contact',
      [
        { property: 'state', value: 'TX' },
        { property: 'state', value: 'CA' },
        { property: 'channel', value: 'email' },
        { property: 'channel', value: 'sms' }
      ],
      'and',
      undefined,
      ['or', 'and', 'or']
    )
    expect(flat.$and).toBeUndefined()
    expect(flat.$or).toBeDefined()
  })

  it('a single group is just that group, with no extra wrapper', () => {
    const query = buildNestedFilterQuery(
      'contact',
      [{ rowGroups: [leaf('state', 'TX'), leaf('state', 'CA')], joins: ['or'] }],
      []
    )
    expect(query.$and).toBeUndefined()
    expect(query.$or).toHaveLength(2)
  })
})
