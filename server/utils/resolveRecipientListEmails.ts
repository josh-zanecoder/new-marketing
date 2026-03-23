import mongoose from 'mongoose'
import type { Connection } from 'mongoose'
import { getTenantClientModels } from '../models/tenant/tenantClientModels'

/**
 * Emails for contacts currently in a recipient list (via `recipient_list_members`).
 */
export async function resolveRecipientListEmails(
  conn: Connection,
  listIdRaw: string
): Promise<string[]> {
  const trimmed = listIdRaw.trim()
  if (!trimmed || !mongoose.isValidObjectId(trimmed)) {
    return []
  }

  const listId = new mongoose.Types.ObjectId(trimmed)
  const { RecipientListMember, Contact } = getTenantClientModels(conn)

  const members = await RecipientListMember.find({ recipientListId: listId })
    .select('contactId')
    .lean()
    .exec()

  const contactIds = members.map((m) => m.contactId).filter(Boolean)
  if (!contactIds.length) {
    return []
  }

  const contacts = await Contact.find({
    _id: { $in: contactIds },
    deletedAt: null
  })
    .select('email')
    .lean()
    .exec()

  const raw = contacts
    .map((c) => String((c as { email?: string }).email ?? '').trim().toLowerCase())
    .filter((e) => e.includes('@'))

  return [...new Set(raw)]
}
