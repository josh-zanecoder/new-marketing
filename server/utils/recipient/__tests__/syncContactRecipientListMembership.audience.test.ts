/* eslint-disable import/first -- vi.mock must precede the imports it replaces */
import mongoose from 'mongoose'
import type { Connection } from 'mongoose'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * "Recipient lists reflect contact changes automatically before each scheduled send":
 * every contact create/update re-runs `syncContactRecipientListMembership`, which ANDs the list's
 * loan-officer scope and borrower-status limit onto the query. These tests drive that function with
 * an in-memory contact and apply the generated query to it, so a contact changing LO / status /
 * unsubscribing moves in and out of the audience.
 */

type TestContact = {
  _id: mongoose.Types.ObjectId
  status: string
  ownerEmail: string
  deletedAt: Date | null
  isUnsubscribe: boolean
}

const LIST_ID = new mongoose.Types.ObjectId()
const CONTACT_ID = new mongoose.Types.ObjectId()

const state = {
  contact: null as TestContact | null,
  members: new Set<string>(),
  queries: [] as Record<string, unknown>[],
  lists: [] as Record<string, unknown>[]
}

/** Applies the owner-scope ($expr) and status clauses; the audience base query is not under test. */
function matches(query: Record<string, unknown>, contact: TestContact): boolean {
  if (Array.isArray(query.$and)) {
    return (query.$and as Record<string, unknown>[]).every((q) => matches(q, contact))
  }
  if (query.$expr) {
    const $in = (query.$expr as { $in: [unknown, string[]] }).$in
    return $in[1].includes(contact.ownerEmail.trim().toLowerCase())
  }
  const status = query.status as { $in?: RegExp[] } | undefined
  if (status?.$in) return status.$in.some((re) => re.test(contact.status))
  if ('_id' in query) return String(query._id) === String(contact._id)
  return true
}

vi.mock('@server/models/tenant/tenantClientModels', () => ({
  getTenantClientModels: () => ({
    Contact: {
      findById: () => ({
        select: () => ({ lean: async () => state.contact })
      }),
      findOne: (q: Record<string, unknown>) => {
        state.queries.push(q)
        return {
          select: () => ({
            lean: async () =>
              state.contact && matches(q, state.contact) ? { _id: state.contact._id } : null
          })
        }
      }
    },
    RecipientList: { find: () => ({ lean: async () => state.lists }) },
    RecipientFilter: { find: () => ({ lean: () => ({ exec: async () => [] }) }) },
    RecipientListMember: {
      updateOne: async (filter: { contactId: unknown }) => {
        state.members.add(String(filter.contactId))
      },
      deleteOne: async (filter: { contactId: unknown }) => {
        state.members.delete(String(filter.contactId))
      },
      deleteMany: async (filter: { contactId: unknown }) => {
        state.members.delete(String(filter.contactId))
      }
    }
  })
}))

import { syncContactRecipientListMembership } from '../syncContactRecipientListMembership'

const conn = {} as Connection

function contact(over: Partial<TestContact>): TestContact {
  return {
    _id: CONTACT_ID,
    status: 'past_borrower',
    ownerEmail: 'rajeev@acme.com',
    deletedAt: null,
    isUnsubscribe: false,
    ...over
  }
}

async function sync(c: TestContact): Promise<boolean> {
  state.contact = c
  await syncContactRecipientListMembership(conn, CONTACT_ID)
  return state.members.has(String(CONTACT_ID))
}

describe('syncContactRecipientListMembership — loan officer + status audience', () => {
  beforeEach(() => {
    state.queries.length = 0
    state.members.clear()
    state.contact = null
    state.lists = [
      {
        _id: LIST_ID,
        name: 'Campaign audience · Spring',
        listType: 'dynamic',
        audience: 'borrower',
        filters: [],
        filterMode: 'and',
        membershipScope: 'owner_emails',
        membershipOwnerEmails: ['rajeev@acme.com', 'dana@acme.com'],
        audienceStatuses: ['past_borrower'],
        campaignAudience: true
      }
    ]
  })

  it('adds a contact owned by a selected loan officer with an allowed status', async () => {
    expect(await sync(contact({}))).toBe(true)
  })

  it('matches status and owner case-insensitively', async () => {
    expect(await sync(contact({ status: 'PAST_Borrower', ownerEmail: ' Dana@Acme.com ' }))).toBe(true)
  })

  it('removes the contact when they are reassigned to a loan officer who is not selected', async () => {
    expect(await sync(contact({}))).toBe(true)
    expect(await sync(contact({ ownerEmail: 'sam@acme.com' }))).toBe(false)
  })

  it('removes the contact when their status leaves the selected categories, and re-adds it', async () => {
    expect(await sync(contact({}))).toBe(true)
    expect(await sync(contact({ status: 'active_borrower' }))).toBe(false)
    expect(await sync(contact({ status: 'past_borrower' }))).toBe(true)
  })

  it('removes an unsubscribed or deleted contact whatever the filters say', async () => {
    expect(await sync(contact({}))).toBe(true)
    expect(await sync(contact({ isUnsubscribe: true }))).toBe(false)
    expect(await sync(contact({}))).toBe(true)
    expect(await sync(contact({ deletedAt: new Date() }))).toBe(false)
  })

  it('with no status limit, any status for a selected loan officer qualifies', async () => {
    state.lists = [{ ...state.lists[0]!, audienceStatuses: [] }]
    expect(await sync(contact({ status: 'active_borrower' }))).toBe(true)
  })

  it('applies a built-in contact field (e.g. state) to the live audience as well', async () => {
    state.lists = [
      {
        ...state.lists[0]!,
        audienceStatuses: [],
        filterRows: [{ recipientFilterId: 'builtin:state', listPropertyValue: 'TX' }]
      }
    ]
    await sync(contact({}))
    const query = JSON.stringify(state.queries[0], (_k, v) => (v instanceof RegExp ? v.toString() : v))
    expect(query).toContain('address.state')
    expect(query).toContain('TX')
  })

  it('uses a marketing category for the status limit', async () => {
    state.lists = [{ ...state.lists[0]!, audienceStatuses: ['category:past_clients'] }]
    expect(await sync(contact({ status: 'past_borrower' }))).toBe(true)
    expect(await sync(contact({ status: 'new_lead' }))).toBe(false)
  })
})
