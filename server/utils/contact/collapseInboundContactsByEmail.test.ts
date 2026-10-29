import { describe, expect, it } from 'vitest'
import {
  inboundCollapseBulkOps,
  planInboundContactCollapse
} from './collapseInboundContactsByEmail'

describe('planInboundContactCollapse', () => {
  it('updates the newest row for an email and retires the other copies', () => {
    const plans = planInboundContactCollapse({
      rows: [
        {
          email: 'alice@mailinator.com',
          externalId: 'borrower-3',
          setDoc: { firstName: 'Alice', lastName: 'Firstimer' }
        }
      ],
      existing: [
        {
          _id: 'old',
          email: 'alice@mailinator.com',
          externalId: 'borrower-1',
          updatedAt: '2026-09-01T00:00:00.000Z',
          isUnsubscribe: true
        },
        {
          _id: 'newer',
          email: 'Alice@Mailinator.com',
          externalId: 'borrower-2',
          updatedAt: '2026-10-01T00:00:00.000Z',
          isUnsubscribe: false
        }
      ]
    })

    expect(plans).toHaveLength(1)
    expect(plans[0]).toMatchObject({
      email: 'alice@mailinator.com',
      externalId: 'borrower-3',
      keepId: 'newer',
      retireIds: ['old']
    })
    expect(plans[0]?.setDoc.isUnsubscribe).toBe(true)
  })

  it('inserts when the email is new', () => {
    const plans = planInboundContactCollapse({
      rows: [
        {
          email: 'new@example.com',
          externalId: 'borrower-9',
          setDoc: { firstName: 'New' }
        }
      ],
      existing: []
    })
    expect(plans[0]).toMatchObject({ keepId: null, retireIds: [] })
  })

  it('collapses duplicate emails inside one sync batch', () => {
    const plans = planInboundContactCollapse({
      rows: [
        { email: 'alice@mailinator.com', externalId: 'a', setDoc: { firstName: 'First' } },
        { email: 'alice@mailinator.com', externalId: 'b', setDoc: { firstName: 'Last' } }
      ],
      existing: []
    })
    expect(plans).toHaveLength(1)
    expect(plans[0]?.externalId).toBe('b')
    expect(plans[0]?.setDoc.firstName).toBe('Last')
  })
})

describe('inboundCollapseBulkOps', () => {
  it('upserts a new email and soft-deletes retired copies', () => {
    const deletedAt = new Date('2026-10-29T00:00:00.000Z')
    const ops = inboundCollapseBulkOps({
      source: 'crm-kafka',
      deletedAt,
      plans: [
        {
          email: 'alice@mailinator.com',
          externalId: 'borrower-3',
          setDoc: { email: 'alice@mailinator.com', externalId: 'borrower-3' },
          keepId: 'newer',
          retireIds: ['old']
        }
      ]
    })

    expect(ops).toEqual([
      {
        updateOne: {
          filter: { _id: 'newer' },
          update: { $set: { email: 'alice@mailinator.com', externalId: 'borrower-3' } }
        }
      },
      {
        updateOne: {
          filter: { _id: 'old' },
          update: { $set: { deletedAt } }
        }
      }
    ])
  })
})
