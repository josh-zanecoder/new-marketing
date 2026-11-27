import { describe, expect, it, vi } from 'vitest'
import type { InboundContactExisting } from './collapseInboundContactsByEmail'
import {
  mergeDuplicateContactsByEmail,
  planDuplicateMerge,
  type DuplicateMergeContactCollection
} from './mergeDuplicateContactsByEmail'
import {
  ensureUniqueActiveContactEmailIndex,
  uniqueActiveContactEmailIndexOptions
} from './uniqueActiveContactEmailIndex'

const oldest: InboundContactExisting = {
  _id: 'oldest',
  email: 'donson@mailinator.com',
  externalId: 'borrower-A',
  createdAt: '2026-09-01T00:00:00.000Z',
  firstName: 'donson',
  lastName: '',
  phone: ''
}
const newer: InboundContactExisting = {
  _id: 'newer',
  email: 'donson@mailinator.com',
  externalId: 'borrower-B',
  createdAt: '2026-10-01T00:00:00.000Z',
  firstName: 'Donson',
  lastName: 'Test',
  phone: '555-0100',
  loanStatus: 'Loan Open',
  loanStatusKey: 'loan open',
  loanStatusUpdatedAt: '2026-11-25T00:00:00.000Z'
}

describe('planDuplicateMerge', () => {
  it('returns null when there is nothing to merge', () => {
    expect(planDuplicateMerge([oldest])).toBeNull()
    expect(planDuplicateMerge([])).toBeNull()
  })

  it('keeps the oldest contact and moves the newest loan status and blank details onto it', () => {
    const plan = planDuplicateMerge([newer, oldest])
    expect(plan?.keepId).toBe('oldest')
    expect(plan?.retireIds).toEqual(['newer'])
    expect(plan?.set).toMatchObject({
      loanStatus: 'Loan Open',
      loanStatusKey: 'loan open',
      lastName: 'Test',
      phone: '555-0100'
    })
    // The survivor already has a first name, so it is not replaced.
    expect(plan?.set).not.toHaveProperty('firstName')
  })

  it('keeps unsubscribe sticky across the merged copies', () => {
    const plan = planDuplicateMerge([oldest, { ...newer, isUnsubscribe: true }])
    expect(plan?.set.isUnsubscribe).toBe(true)
  })

  it('does not overwrite a newer loan status the survivor already has', () => {
    const survivorWithStatus = {
      ...oldest,
      loanStatus: 'Funded',
      loanStatusKey: 'funded',
      loanStatusUpdatedAt: '2026-12-01T00:00:00.000Z'
    }
    const plan = planDuplicateMerge([survivorWithStatus, newer])
    expect(plan?.set).not.toHaveProperty('loanStatus')
  })
})

describe('mergeDuplicateContactsByEmail', () => {
  function fakeCollection(
    groups: Array<{ _id: string; ids: unknown[] }>,
    docs: InboundContactExisting[]
  ) {
    const bulkWrite = vi.fn().mockResolvedValue({})
    const Contact: DuplicateMergeContactCollection = {
      aggregate: async () => groups,
      find: () => ({ select: () => ({ lean: async () => docs }) }),
      bulkWrite
    }
    return { Contact, bulkWrite }
  }

  it('does nothing for a clean tenant', async () => {
    const { Contact, bulkWrite } = fakeCollection([], [])
    const result = await mergeDuplicateContactsByEmail({ Contact, source: 'crm-kafka' })
    expect(result).toEqual({ groups: 0, keptIds: [], retiredIds: [], hasMore: false })
    expect(bulkWrite).not.toHaveBeenCalled()
  })

  it('merges a duplicate group into the oldest contact and soft-deletes the rest', async () => {
    const now = new Date('2026-11-28T00:00:00.000Z')
    const { Contact, bulkWrite } = fakeCollection(
      [{ _id: 'donson@mailinator.com', ids: ['oldest', 'newer'] }],
      [oldest, newer]
    )
    const result = await mergeDuplicateContactsByEmail({ Contact, source: 'crm-kafka', now })

    expect(result).toMatchObject({ groups: 1, keptIds: ['oldest'], retiredIds: ['newer'], hasMore: false })
    const ops = bulkWrite.mock.calls[0]?.[0] as Array<{ updateOne: { filter: unknown; update: { $set: Record<string, unknown> } } }>
    expect(ops).toHaveLength(2)
    expect(ops[0]?.updateOne.filter).toEqual({ _id: 'oldest' })
    expect(ops[0]?.updateOne.update.$set).toMatchObject({ loanStatus: 'Loan Open' })
    expect(ops[1]).toEqual({
      updateOne: { filter: { _id: 'newer' }, update: { $set: { deletedAt: now } } }
    })
  })

  it('reports hasMore when more groups exist than the limit', async () => {
    const { Contact } = fakeCollection(
      [
        { _id: 'a@x.com', ids: ['a1', 'a2'] },
        { _id: 'b@x.com', ids: ['b1', 'b2'] }
      ],
      [
        { _id: 'a1', email: 'a@x.com', createdAt: '2026-01-01T00:00:00.000Z' },
        { _id: 'a2', email: 'a@x.com', createdAt: '2026-02-01T00:00:00.000Z' }
      ]
    )
    const result = await mergeDuplicateContactsByEmail({ Contact, source: 'crm-kafka', maxGroups: 1 })
    expect(result.hasMore).toBe(true)
    expect(result.keptIds).toEqual(['a1'])
  })
})

describe('unique active-email index', () => {
  it('only covers active contacts of the synced source', () => {
    expect(uniqueActiveContactEmailIndexOptions('crm-kafka')).toEqual({
      name: 'uniq_active_crm_kafka_email',
      unique: true,
      partialFilterExpression: { source: 'crm-kafka', deletedAt: { $type: 'null' } }
    })
  })

  it('creates the index and reports success', async () => {
    const createIndex = vi.fn().mockResolvedValue('uniq_active_crm_kafka_email')
    await expect(ensureUniqueActiveContactEmailIndex({ createIndex }, 'crm-kafka')).resolves.toBe(true)
    expect(createIndex).toHaveBeenCalledWith({ email: 1 }, expect.objectContaining({ unique: true }))
  })

  it('never throws when the build fails (duplicates still exist)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const createIndex = vi.fn().mockRejectedValue(new Error('E11000 duplicate key'))
    await expect(ensureUniqueActiveContactEmailIndex({ createIndex }, 'crm-kafka')).resolves.toBe(false)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
