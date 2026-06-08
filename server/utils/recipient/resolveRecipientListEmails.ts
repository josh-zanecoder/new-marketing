import mongoose from 'mongoose'
import type { Connection, Types } from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { withMarketableContactFilter } from '@server/utils/contact/marketableContact'

/** Member order, deduped by `contactId`, for persisting list campaigns as `ManualRecipient` rows. */
export async function resolveRecipientListContactIds(
  conn: Connection,
  listIdRaw: string
): Promise<Types.ObjectId[]> {
  return resolveRecipientListMarketableContactIds(conn, listIdRaw)
}

export async function resolveRecipientListMarketableContactIds(
  conn: Connection,
  listIdRaw: string
): Promise<Types.ObjectId[]> {
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

  const docs = await Contact.find(withMarketableContactFilter({ _id: { $in: contactIds } }))
    .select('_id')
    .lean<Array<{ _id: mongoose.Types.ObjectId }>>()
    .exec()

  const allowed = new Set(docs.map((d) => String(d._id)))
  const seen = new Set<string>()
  const out: mongoose.Types.ObjectId[] = []
  for (const m of members) {
    if (!m.contactId) continue
    const s = String(m.contactId)
    if (!allowed.has(s) || seen.has(s)) continue
    seen.add(s)
    out.push(m.contactId)
  }
  return out
}

type MemberWithListLean = {
  recipientListId?: mongoose.Types.ObjectId
  contactId?: mongoose.Types.ObjectId
}

export function emailsForListMembers(
  members: MemberWithListLean[],
  emailByContactId: Map<string, string>
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const m of members) {
    if (!m.contactId) continue
    const email = emailByContactId.get(String(m.contactId)) ?? ''
    if (!email || seen.has(email)) continue
    seen.add(email)
    out.push(email)
  }
  return out
}

/** Resolve list emails in two queries total (members + contacts), keyed by list id string. */
export async function batchResolveRecipientListEmails(
  conn: Connection,
  listIdRaws: string[]
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>()
  const listIds: mongoose.Types.ObjectId[] = []
  const seenListIds = new Set<string>()

  for (const raw of listIdRaws) {
    const trimmed = String(raw ?? '').trim()
    if (!trimmed || !mongoose.isValidObjectId(trimmed)) {
      if (trimmed) result.set(trimmed, [])
      continue
    }
    const key = String(new mongoose.Types.ObjectId(trimmed))
    result.set(key, [])
    if (!seenListIds.has(key)) {
      seenListIds.add(key)
      listIds.push(new mongoose.Types.ObjectId(trimmed))
    }
  }

  if (!listIds.length) return result

  const { RecipientListMember, Contact } = getTenantClientModels(conn)
  const members = await RecipientListMember.find({ recipientListId: { $in: listIds } })
    .select('recipientListId contactId')
    .lean<MemberWithListLean[]>()
    .exec()

  const contactIds = members.map((m) => m.contactId).filter(Boolean)
  if (!contactIds.length) return result

  const contacts = await Contact.find(withMarketableContactFilter({ _id: { $in: contactIds } }))
    .select('email')
    .lean<Array<{ _id: mongoose.Types.ObjectId; email?: string }>>()
    .exec()

  const emailByContactId = new Map<string, string>()
  for (const c of contacts) {
    const email = String(c.email ?? '').trim().toLowerCase()
    if (email.includes('@')) emailByContactId.set(String(c._id), email)
  }

  const membersByListId = new Map<string, MemberWithListLean[]>()
  for (const m of members) {
    if (!m.recipientListId) continue
    const listKey = String(m.recipientListId)
    if (!membersByListId.has(listKey)) membersByListId.set(listKey, [])
    membersByListId.get(listKey)!.push(m)
  }

  for (const [listKey, listMembers] of membersByListId) {
    result.set(listKey, emailsForListMembers(listMembers, emailByContactId))
  }

  return result
}

export async function resolveRecipientListEmails(
  conn: Connection,
  listIdRaw: string
): Promise<string[]> {
  const trimmed = listIdRaw.trim()
  if (!trimmed || !mongoose.isValidObjectId(trimmed)) {
    return []
  }
  const map = await batchResolveRecipientListEmails(conn, [trimmed])
  return map.get(String(new mongoose.Types.ObjectId(trimmed))) ?? []
}
