import mongoose from 'mongoose'
import { describe, expect, it } from 'vitest'
import { emailsForListMembers } from '../resolveRecipientListEmails'

describe('emailsForListMembers', () => {
  it('preserves member order and dedupes emails within a list', () => {
    const c1 = new mongoose.Types.ObjectId()
    const c2 = new mongoose.Types.ObjectId()
    const c3 = new mongoose.Types.ObjectId()
    const emailByContactId = new Map<string, string>([
      [String(c1), 'alice@example.com'],
      [String(c2), 'bob@example.com'],
      [String(c3), 'alice@example.com']
    ])

    const emails = emailsForListMembers(
      [
        { contactId: c1 },
        { contactId: c2 },
        { contactId: c3 },
        { contactId: c1 }
      ],
      emailByContactId
    )

    expect(emails).toEqual(['alice@example.com', 'bob@example.com'])
  })

  it('skips members without a marketable email', () => {
    const c1 = new mongoose.Types.ObjectId()
    const emails = emailsForListMembers([{ contactId: c1 }], new Map())
    expect(emails).toEqual([])
  })
})
