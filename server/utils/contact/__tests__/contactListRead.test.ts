import { describe, expect, it } from 'vitest'
import {
  buildContactListMongoFilter,
  CONTACT_LIST_DEFAULT_PAGE_SIZE,
  CONTACT_LIST_MAX_PAGE_SIZE,
  parseContactListQuery
} from '../contactListRead'

describe('contactListRead', () => {
  it('parses page and limit with caps', () => {
    const q = parseContactListQuery({ page: '2', limit: '500' })
    expect(q.page).toBe(2)
    expect(q.pageSize).toBe(CONTACT_LIST_MAX_PAGE_SIZE)
  })

  it('defaults to a bounded page size (never unbounded)', () => {
    const q = parseContactListQuery({})
    expect(q.pageSize).toBe(CONTACT_LIST_DEFAULT_PAGE_SIZE)
    expect(q.pageSize).toBeLessThanOrEqual(CONTACT_LIST_MAX_PAGE_SIZE)
  })

  it('parses search and filters', () => {
    const q = parseContactListQuery({
      search: 'acme',
      subscription: 'unsubscribed',
      contactType: 'broker'
    })
    expect(q.search).toBe('acme')
    expect(q.subscription).toBe('unsubscribed')
    expect(q.contactType).toBe('broker')
  })

  it('builds subscription and type filters', () => {
    const filter = buildContactListMongoFilter(null, {
      search: '',
      subscription: 'subscribed',
      contactType: '__none__'
    })
    expect(filter).toMatchObject({
      $and: expect.arrayContaining([
        { deletedAt: null },
        { isUnsubscribe: { $ne: true } },
        { $or: [{ contactType: { $exists: false } }, { contactType: { $size: 0 } }] }
      ])
    })
  })

  it('adds regex search clause for multi-char name queries', () => {
    const filter = buildContactListMongoFilter(null, {
      search: 'acme lending',
      subscription: 'all',
      contactType: 'all'
    })
    expect(filter.$and).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          $or: expect.arrayContaining([{ firstName: expect.any(RegExp) }])
        })
      ])
    )
  })

  it('uses email-prefix filter for email-like queries', () => {
    const filter = buildContactListMongoFilter(null, {
      search: 'jane.doe',
      subscription: 'all',
      contactType: 'all'
    })
    expect(filter.$and).toEqual(
      expect.arrayContaining([{ email: expect.any(RegExp) }])
    )
  })
})
