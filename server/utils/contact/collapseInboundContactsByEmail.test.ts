import { describe, expect, it, vi } from 'vitest'
import {
  collapseInboundContactsByEmail,
  inboundCollapseBulkOps,
  isDuplicateKeyError,
  pickStableKeeper,
  planInboundContactCollapse,
  type InboundContactCollection,
  type InboundContactExisting
} from './collapseInboundContactsByEmail'

describe('pickStableKeeper', () => {
  it('keeps the oldest contact, whatever its updatedAt', () => {
    const older = { _id: 'a', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-02T00:00:00.000Z' }
    const newer = { _id: 'b', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z' }
    expect(pickStableKeeper(older, newer)).toBe(older)
    expect(pickStableKeeper(newer, older)).toBe(older)
  })

  it('falls back to the ObjectId timestamp, then the lowest id', () => {
    const early = { _id: '5f0000000000000000000002' }
    const late = { _id: '6a0000000000000000000001' }
    expect(pickStableKeeper(late, early)).toBe(early)
    expect(pickStableKeeper({ _id: 'b' }, { _id: 'a' })._id).toBe('a')
  })
})

describe('planInboundContactCollapse', () => {
  it('keeps the oldest contact for an email and retires the other copies', () => {
    const plans = planInboundContactCollapse({
      rows: [
        {
          email: 'alice@mailinator.com',
          externalId: 'borrower-1',
          setDoc: { firstName: 'Alice', lastName: 'Firstimer' }
        }
      ],
      existing: [
        {
          _id: 'old',
          email: 'alice@mailinator.com',
          externalId: 'borrower-1',
          createdAt: '2026-09-01T00:00:00.000Z',
          updatedAt: '2026-09-01T00:00:00.000Z',
          isUnsubscribe: true
        },
        {
          _id: 'newer',
          email: 'Alice@Mailinator.com',
          externalId: 'borrower-2',
          createdAt: '2026-10-01T00:00:00.000Z',
          updatedAt: '2026-10-05T00:00:00.000Z',
          isUnsubscribe: false
        }
      ]
    })

    expect(plans).toHaveLength(1)
    expect(plans[0]).toMatchObject({
      email: 'alice@mailinator.com',
      externalId: 'borrower-1',
      keepId: 'old',
      retireIds: ['newer']
    })
    expect(plans[0]?.setDoc.isUnsubscribe).toBe(true)
    expect(plans[0]?.setDoc).toMatchObject({ firstName: 'Alice', externalId: 'borrower-1' })
  })

  describe('one stable contact per email', () => {
    const survivor: InboundContactExisting = {
      _id: 'survivor',
      email: 'donson@mailinator.com',
      externalId: 'borrower-A',
      createdAt: '2026-09-01T00:00:00.000Z',
      firstName: 'donson',
      lastName: '',
      phone: '',
      company: ''
    }

    it('lets the survivor’s own borrower record update it fully', () => {
      const [plan] = planInboundContactCollapse({
        rows: [
          {
            email: 'donson@mailinator.com',
            externalId: 'borrower-A',
            setDoc: { firstName: 'Donson', metadata: { ownerEmail: 'lo-a@example.com' } }
          }
        ],
        existing: [survivor]
      })
      expect(plan?.keepId).toBe('survivor')
      expect(plan?.setDoc).toMatchObject({
        externalId: 'borrower-A',
        firstName: 'Donson',
        metadata: { ownerEmail: 'lo-a@example.com' }
      })
    })

    it('does not let a secondary borrower record take over externalId, owner or details', () => {
      const [plan] = planInboundContactCollapse({
        rows: [
          {
            email: 'donson@mailinator.com',
            externalId: 'borrower-B',
            setDoc: {
              firstName: 'Other',
              lastName: 'Person',
              phone: '555-0100',
              company: 'Acme',
              status: 'lead',
              metadata: { ownerEmail: 'lo-b@example.com' }
            }
          }
        ],
        existing: [survivor]
      })
      expect(plan?.keepId).toBe('survivor')
      expect(plan?.externalId).toBe('borrower-A')
      expect(plan?.setDoc).not.toHaveProperty('externalId')
      expect(plan?.setDoc).not.toHaveProperty('metadata')
      expect(plan?.setDoc).not.toHaveProperty('status')
      // The survivor already has a first name, so only its blank fields are filled.
      expect(plan?.setDoc).not.toHaveProperty('firstName')
      expect(plan?.setDoc).toMatchObject({
        lastName: 'Person',
        phone: '555-0100',
        company: 'Acme'
      })
    })

    it('still brings a newer loan status from a secondary borrower record', () => {
      const [plan] = planInboundContactCollapse({
        rows: [
          {
            email: 'donson@mailinator.com',
            externalId: 'borrower-B',
            setDoc: {
              loanStatus: 'Loan Open',
              loanStatusKey: 'loan open',
              loanStatusUpdatedAt: new Date('2026-11-25T00:00:00.000Z')
            }
          }
        ],
        existing: [survivor]
      })
      expect(plan?.setDoc).toMatchObject({ loanStatus: 'Loan Open', loanStatusKey: 'loan open' })
      expect(plan?.setDoc).not.toHaveProperty('externalId')
    })

    it('uses the survivor’s own row when it arrives in the same batch as a secondary row', () => {
      const [plan] = planInboundContactCollapse({
        rows: [
          { email: 'donson@mailinator.com', externalId: 'borrower-A', setDoc: { firstName: 'Own' } },
          { email: 'donson@mailinator.com', externalId: 'borrower-B', setDoc: { firstName: 'Secondary' } }
        ],
        existing: [survivor]
      })
      expect(plan?.setDoc).toMatchObject({ externalId: 'borrower-A', firstName: 'Own' })
    })

    it('picks the newest loan status across rows of the same email', () => {
      const [plan] = planInboundContactCollapse({
        rows: [
          {
            email: 'donson@mailinator.com',
            externalId: 'borrower-A',
            setDoc: {
              loanStatus: 'Lead New',
              loanStatusKey: 'lead new',
              loanStatusUpdatedAt: new Date('2026-10-01T00:00:00.000Z')
            }
          },
          {
            email: 'donson@mailinator.com',
            externalId: 'borrower-B',
            setDoc: {
              loanStatus: 'Loan Open',
              loanStatusKey: 'loan open',
              loanStatusUpdatedAt: new Date('2026-11-25T00:00:00.000Z')
            }
          }
        ],
        existing: [survivor]
      })
      expect(plan?.setDoc).toMatchObject({ externalId: 'borrower-A', loanStatus: 'Loan Open' })
    })

    it('the first row owns a brand-new email when several arrive in one batch', () => {
      const plans = planInboundContactCollapse({
        rows: [
          { email: 'alice@mailinator.com', externalId: 'a', setDoc: { firstName: 'First' } },
          { email: 'alice@mailinator.com', externalId: 'b', setDoc: { firstName: 'Last' } }
        ],
        existing: []
      })
      expect(plans).toHaveLength(1)
      expect(plans[0]?.externalId).toBe('a')
      expect(plans[0]?.setDoc.firstName).toBe('First')
      expect(plans[0]).toMatchObject({ keepId: null, retireIds: [] })
    })

    it('a survivor without an externalId is claimed by the first incoming row', () => {
      const [plan] = planInboundContactCollapse({
        rows: [{ email: 'x@example.com', externalId: 'b-1', setDoc: { firstName: 'X' } }],
        existing: [{ _id: 'legacy', email: 'x@example.com', externalId: '', createdAt: '2026-01-01T00:00:00.000Z' }]
      })
      expect(plan?.keepId).toBe('legacy')
      expect(plan?.setDoc).toMatchObject({ externalId: 'b-1', firstName: 'X' })
    })
  })

  describe('LendingQB loan status policy', () => {
    const existingFunded = {
      _id: 'keep',
      email: 'bob@example.com',
      externalId: 'b-1',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
      loanStatus: 'LQB Funded',
      loanStatusKey: 'funded',
      loanStatusUpdatedAt: '2026-10-05T00:00:00.000Z'
    }

    it('does not wipe the loan status on an ordinary update that carries none', () => {
      const [plan] = planInboundContactCollapse({
        rows: [{ email: 'bob@example.com', externalId: 'b-1', setDoc: { firstName: 'Bob' } }],
        existing: [existingFunded]
      })
      expect(plan?.keepId).toBe('keep')
      expect(plan?.setDoc).not.toHaveProperty('loanStatus')
      expect(plan?.setDoc).not.toHaveProperty('loanStatusKey')
      expect(plan?.setDoc).not.toHaveProperty('loanStatusUpdatedAt')
    })

    it('applies a newer incoming loan status', () => {
      const incoming = {
        loanStatus: 'LQB Loan Open',
        loanStatusKey: 'loan open',
        loanStatusUpdatedAt: new Date('2026-10-09T00:00:00.000Z')
      }
      const [plan] = planInboundContactCollapse({
        rows: [{ email: 'bob@example.com', externalId: 'b-1', setDoc: { ...incoming } }],
        existing: [existingFunded]
      })
      expect(plan?.setDoc).toMatchObject(incoming)
    })

    it('ignores an older (out-of-order) incoming loan status', () => {
      const [plan] = planInboundContactCollapse({
        rows: [
          {
            email: 'bob@example.com',
            externalId: 'b-1',
            setDoc: {
              loanStatus: 'LQB Loan Open',
              loanStatusKey: 'loan open',
              loanStatusUpdatedAt: new Date('2026-10-02T00:00:00.000Z')
            }
          }
        ],
        existing: [existingFunded]
      })
      expect(plan?.setDoc).toMatchObject({
        loanStatus: 'LQB Funded',
        loanStatusKey: 'funded',
        loanStatusUpdatedAt: '2026-10-05T00:00:00.000Z'
      })
    })

    it('keeps the newest loan status when duplicate copies are merged', () => {
      const [plan] = planInboundContactCollapse({
        rows: [{ email: 'bob@example.com', externalId: 'b-2', setDoc: { firstName: 'Bob' } }],
        existing: [
          {
            _id: 'oldest-copy',
            email: 'bob@example.com',
            externalId: 'b-2',
            createdAt: '2026-08-01T00:00:00.000Z',
            updatedAt: '2026-10-08T00:00:00.000Z'
          },
          { ...existingFunded, _id: 'newer-copy', createdAt: '2026-09-01T00:00:00.000Z' }
        ]
      })
      expect(plan?.keepId).toBe('oldest-copy')
      expect(plan?.retireIds).toEqual(['newer-copy'])
      expect(plan?.setDoc).toMatchObject({ loanStatus: 'LQB Funded', loanStatusKey: 'funded' })
    })
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
})

describe('inboundCollapseBulkOps', () => {
  it('retires the other copies before writing the survivor', () => {
    const deletedAt = new Date('2026-10-29T00:00:00.000Z')
    const ops = inboundCollapseBulkOps({
      source: 'crm-kafka',
      deletedAt,
      plans: [
        {
          email: 'alice@mailinator.com',
          externalId: 'borrower-3',
          setDoc: { email: 'alice@mailinator.com', externalId: 'borrower-3' },
          keepId: 'older',
          retireIds: ['newer']
        }
      ]
    })

    expect(ops).toEqual([
      {
        updateOne: {
          filter: { _id: 'newer' },
          update: { $set: { deletedAt } }
        }
      },
      {
        updateOne: {
          filter: { _id: 'older' },
          update: { $set: { email: 'alice@mailinator.com', externalId: 'borrower-3' } }
        }
      }
    ])
  })

  it('upserts a new email', () => {
    const ops = inboundCollapseBulkOps({
      source: 'crm-kafka',
      deletedAt: new Date(),
      plans: [
        {
          email: 'new@example.com',
          externalId: 'b-1',
          setDoc: { email: 'new@example.com' },
          keepId: null,
          retireIds: []
        }
      ]
    })
    expect(ops).toEqual([
      {
        updateOne: {
          filter: { source: 'crm-kafka', email: 'new@example.com', deletedAt: null },
          update: { $set: { email: 'new@example.com' } },
          upsert: true
        }
      }
    ])
  })
})

describe('collapseInboundContactsByEmail', () => {
  function fakeCollection(finds: InboundContactExisting[][], bulkWrite: InboundContactCollection['bulkWrite']) {
    const queue = [...finds]
    const Contact: InboundContactCollection = {
      find: () => ({
        select: () => ({ lean: async () => queue.shift() ?? [] })
      }),
      bulkWrite
    }
    return Contact
  }

  it('re-reads and plans again when a concurrent insert wins the unique-email race', async () => {
    const bulkWrite = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('E11000 duplicate key'), { code: 11000 }))
      .mockResolvedValueOnce({})
    const winner: InboundContactExisting = {
      _id: 'winner',
      email: 'race@example.com',
      externalId: 'b-1',
      createdAt: '2026-11-01T00:00:00.000Z'
    }
    const Contact = fakeCollection([[], [winner]], bulkWrite)

    const result = await collapseInboundContactsByEmail({
      Contact,
      source: 'crm-kafka',
      rows: [{ email: 'race@example.com', externalId: 'b-2', setDoc: { firstName: 'Race' } }]
    })

    expect(bulkWrite).toHaveBeenCalledTimes(2)
    // Second pass found the winner and updated it as a secondary record (no externalId takeover).
    const secondOps = bulkWrite.mock.calls[1]?.[0] as Array<{ updateOne: { filter: unknown; update: { $set: Record<string, unknown> } } }>
    expect(secondOps[0]?.updateOne.filter).toEqual({ _id: 'winner' })
    expect(secondOps[0]?.updateOne.update.$set).not.toHaveProperty('externalId')
    expect(result.keptIds).toEqual(['winner'])
  })

  it('does not swallow other write errors', async () => {
    const bulkWrite = vi.fn().mockRejectedValue(new Error('network down'))
    const Contact = fakeCollection([[]], bulkWrite)
    await expect(
      collapseInboundContactsByEmail({
        Contact,
        source: 'crm-kafka',
        rows: [{ email: 'a@example.com', externalId: 'b-1', setDoc: {} }]
      })
    ).rejects.toThrow('network down')
    expect(bulkWrite).toHaveBeenCalledTimes(1)
  })
})

describe('isDuplicateKeyError', () => {
  it('recognises E11000 by code or message', () => {
    expect(isDuplicateKeyError({ code: 11000 })).toBe(true)
    expect(isDuplicateKeyError(new Error('E11000 duplicate key error collection'))).toBe(true)
    expect(isDuplicateKeyError(new Error('boom'))).toBe(false)
    expect(isDuplicateKeyError(null)).toBe(false)
  })
})
