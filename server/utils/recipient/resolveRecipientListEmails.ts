import mongoose from 'mongoose'
import type { Connection, Types } from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'

/** Member order, deduped by `contactId`, for persisting list campaigns as `ManualRecipient` rows. */
export async function resolveRecipientListContactIds(
  conn: Connection,
  listIdRaw: string
): Promise<Types.ObjectId[]> {
  const trimmed = listIdRaw.trim()
  if (!trimmed || !mongoose.isValidObjectId(trimmed)) {
    return []
  }

  const listId = new mongoose.Types.ObjectId(trimmed)
  const { RecipientListMember } = getTenantClientModels(conn)

  type MemberLean = { contactId?: mongoose.Types.ObjectId }
  const members = await RecipientListMember.find({ recipientListId: listId })
    .select('contactId')
    .lean<MemberLean[]>()
    .exec()

  const seen = new Set<string>()
  const out: mongoose.Types.ObjectId[] = []
  for (const m of members) {
    if (!m.contactId) continue
    const s = String(m.contactId)
    if (seen.has(s)) continue
    seen.add(s)
    out.push(m.contactId)
  }
  return out
}

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

  type MemberLean = { contactId?: mongoose.Types.ObjectId }
  const members = await RecipientListMember.find({ recipientListId: listId })
    .select('contactId')
    .lean<MemberLean[]>()
    .exec()

  const contactIds = members.map((m) => m.contactId).filter(Boolean)
  if (!contactIds.length) return []

  const contacts = await Contact.find({
    _id: { $in: contactIds },
    deletedAt: null
  }).select('email').lean().exec()

  const raw = contacts
    .map((c) => String((c as { email?: string }).email ?? '').trim().toLowerCase())
    .filter((e) => e.includes('@'))

  return [...new Set(raw)]
}
