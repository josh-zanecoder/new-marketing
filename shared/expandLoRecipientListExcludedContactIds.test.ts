import { Types } from 'mongoose'
import { describe, expect, it } from 'vitest'
import { expandLoRecipientListExcludedContactIds } from '../server/utils/recipient/expandLoRecipientListExcludedContactIds'
import { dedupeByNormalizedEmailKeepFirst } from './dedupeByNormalizedEmail'

type ContactDoc = {
  _id: Types.ObjectId
  email: string
  metadata?: { ownerEmail?: string }
  contactType?: string[]
  deletedAt?: null
  isUnsubscribe?: boolean
}

/**
 * Mirrors LO create: checklist is email-deduped; unchecked rows become exclusions;
 * membership rebuild keeps one row per email after exclusions.
 */
function simulateLoCreateMemberCount(params: {
  contacts: ContactDoc[]
  ownerEmail: string
  checkedEmails: string[]
}): number {
  const owner = params.ownerEmail.trim().toLowerCase()
  const loContacts = params.contacts.filter((c) => {
    const owned = String(c.metadata?.ownerEmail ?? '')
      .trim()
      .toLowerCase()
    return (
      owned === owner &&
      Array.isArray(c.contactType) &&
      c.contactType.includes('borrower') &&
      c.deletedAt == null &&
      c.isUnsubscribe !== true
    )
  })

  const checklist = dedupeByNormalizedEmailKeepFirst(
    loContacts.map((c) => ({
      id: String(c._id),
      email: c.email
    }))
  )
  const checked = new Set(
    params.checkedEmails.map((e) => e.trim().toLowerCase()).filter((e) => e.includes('@'))
  )
  const unchecked = checklist.filter((row) => !checked.has(row.email.trim().toLowerCase()))
  const excludedIds = new Set(unchecked.map((row) => row.id))
  const excludedEmails = new Set(
    unchecked.map((row) => row.email.trim().toLowerCase()).filter((e) => e.includes('@'))
  )

  // Expansion: every Contact sharing an unchecked email is excluded (the bug fix).
  for (const c of loContacts) {
    const email = c.email.trim().toLowerCase()
    if (excludedEmails.has(email)) excludedIds.add(String(c._id))
  }

  const seenEmails = new Set<string>()
  let members = 0
  for (const c of loContacts) {
    const id = String(c._id)
    if (excludedIds.has(id)) continue
    const email = c.email.trim().toLowerCase()
    if (!email.includes('@')) continue
    if (excludedEmails.has(email)) continue
    if (seenEmails.has(email)) continue
    seenEmails.add(email)
    members += 1
  }
  return members
}

function mockContactModel(docs: ContactDoc[]) {
  return {
    find(filter: Record<string, unknown>) {
      const ids = (filter as { _id?: { $in?: Types.ObjectId[] } })._id?.$in
      const and = (filter as { $and?: unknown[] }).$and
      return {
        select() {
          return {
            async lean() {
              if (Array.isArray(ids)) {
                const idSet = new Set(ids.map((id) => String(id)))
                return docs.filter((d) => idSet.has(String(d._id)))
              }
              if (Array.isArray(and)) {
                const emailClause = and.find(
                  (part) =>
                    part &&
                    typeof part === 'object' &&
                    '$expr' in (part as object)
                ) as { $expr?: { $in?: [unknown, string[]] } } | undefined
                const emails = new Set(emailClause?.$expr?.$in?.[1] ?? [])
                return docs.filter((d) => emails.has(d.email.trim().toLowerCase()))
              }
              return docs
            }
          }
        }
      }
    }
  }
}

/** 36 unique borrower emails for one LO; every 3rd email also has a duplicate Contact doc. */
function buildLoBorrowerPool(ownerEmail: string, uniqueCount = 36): {
  contacts: ContactDoc[]
  uniqueEmails: string[]
} {
  const contacts: ContactDoc[] = []
  const uniqueEmails: string[] = []
  for (let i = 0; i < uniqueCount; i++) {
    const email = `borrower${i}@mailinator.com`
    uniqueEmails.push(email)
    contacts.push({
      _id: new Types.ObjectId(),
      email,
      metadata: { ownerEmail },
      contactType: ['borrower'],
      deletedAt: null
    })
    if (i % 3 === 0) {
      contacts.push({
        _id: new Types.ObjectId(),
        email,
        metadata: { ownerEmail },
        contactType: ['borrower'],
        deletedAt: null
      })
    }
  }
  return { contacts, uniqueEmails }
}

describe('LO create membership is dynamic to checked count', () => {
  const ownerEmail = 'hello+sistarlo@zanecoder.com'
  const { contacts, uniqueEmails } = buildLoBorrowerPool(ownerEmail, 36)

  it('pool has 36 unique checklist emails and more Contact docs (duplicates)', () => {
    const checklist = dedupeByNormalizedEmailKeepFirst(
      contacts.map((c) => ({ id: String(c._id), email: c.email }))
    )
    expect(checklist).toHaveLength(36)
    expect(contacts.length).toBeGreaterThan(36)
  })

  it.each([1, 5, 10, 36] as const)(
    'checking %i borrowers creates exactly %i members',
    (checkedCount) => {
      const checkedEmails = uniqueEmails.slice(0, checkedCount)
      expect(
        simulateLoCreateMemberCount({
          contacts,
          ownerEmail,
          checkedEmails
        })
      ).toBe(checkedCount)
    }
  )

  it('expand exclusions for 26 unchecked emails covers all duplicate Contact ids', async () => {
    const checkedEmails = new Set(uniqueEmails.slice(0, 10))
    const checklist = dedupeByNormalizedEmailKeepFirst(
      contacts.map((c) => ({ id: String(c._id), email: c.email }))
    )
    const unchecked = checklist.filter((row) => !checkedEmails.has(row.email))
    expect(unchecked).toHaveLength(26)

    const expanded = await expandLoRecipientListExcludedContactIds({
      Contact: mockContactModel(contacts),
      audience: 'borrower',
      ownerEmail,
      seedIds: unchecked.map((row) => new Types.ObjectId(row.id)),
      seedEmails: unchecked.map((row) => row.email)
    })
    const expandedIds = new Set(expanded.map((id) => String(id)))

    for (const c of contacts) {
      if (checkedEmails.has(c.email)) {
        expect(expandedIds.has(String(c._id))).toBe(false)
      } else {
        expect(expandedIds.has(String(c._id))).toBe(true)
      }
    }
  })

  it('pre-fix id-only exclusions under-count when duplicates exist (not dynamic)', () => {
    const checkedEmails = new Set(uniqueEmails.slice(0, 10))
    const checklist = dedupeByNormalizedEmailKeepFirst(
      contacts.map((c) => ({ id: String(c._id), email: c.email }))
    )
    const unchecked = checklist.filter((row) => !checkedEmails.has(row.email))
    const excludedIdsOnly = new Set(unchecked.map((row) => row.id))
    const seenEmails = new Set<string>()
    let members = 0
    for (const c of contacts) {
      if (excludedIdsOnly.has(String(c._id))) continue
      const email = c.email.trim().toLowerCase()
      if (seenEmails.has(email)) continue
      seenEmails.add(email)
      members += 1
    }
    // With duplicates on unchecked emails, id-only exclusion leaks those emails back in.
    expect(members).toBeGreaterThan(10)
  })
})
