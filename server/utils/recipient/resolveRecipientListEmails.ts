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

/**
 * Optional inclusion filter for list-based campaigns.
 * - missing / empty / no valid ObjectIds → keep all list members (full list)
 * - non-empty valid ids → intersection with list members
 * The source list is not modified. (Empty selection is blocked in the UI before save.)
 */
export function filterListContactIdsByInclusion(
  listContactIds: Types.ObjectId[],
  includeContactIds?: string[] | null
): Types.ObjectId[] {
  if (includeContactIds == null || !includeContactIds.length) return listContactIds
  const allowed = new Set(
    includeContactIds
      .map((id) => String(id ?? '').trim())
      .filter((id) => mongoose.isValidObjectId(id))
  )
  if (!allowed.size) return listContactIds
  return listContactIds.filter((id) => allowed.has(String(id)))
}

export async function resolveRecipientListContactIdsWithInclusion(
  conn: Connection,
  listIdRaw: string,
  includeContactIds?: string[] | null
): Promise<Types.ObjectId[]> {
  const listIds = await resolveRecipientListMarketableContactIds(conn, listIdRaw)
  return filterListContactIdsByInclusion(listIds, includeContactIds)
}

export async function resolveRecipientListEmails(
  conn: Connection,
  listIdRaw: string,
  includeContactIds?: string[] | null
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

  let contactIds = members.map((m) => m.contactId).filter(Boolean) as Types.ObjectId[]
  contactIds = filterListContactIdsByInclusion(contactIds, includeContactIds ?? null)
  if (!contactIds.length) return []

  const contacts = await Contact.find(
    withMarketableContactFilter({ _id: { $in: contactIds } })
  )
    .select('email')
    .lean()
    .exec()

  const raw = contacts
    .map((c) => String((c as { email?: string }).email ?? '').trim().toLowerCase())
    .filter((e) => e.includes('@'))

  return [...new Set(raw)]
}

/** Marketable list members with email + contactId (for campaign draft display / selection hydrate). */
export async function resolveRecipientListContactRows(
  conn: Connection,
  listIdRaw: string,
  includeContactIds?: string[] | null
): Promise<Array<{ contactId: string; email: string }>> {
  const contactIds = await resolveRecipientListContactIdsWithInclusion(
    conn,
    listIdRaw,
    includeContactIds
  )
  if (!contactIds.length) return []

  const { Contact } = getTenantClientModels(conn)
  const contacts = await Contact.find(withMarketableContactFilter({ _id: { $in: contactIds } }))
    .select('_id email')
    .lean<Array<{ _id: Types.ObjectId; email?: string }>>()
    .exec()

  const emailById = new Map(
    contacts.map((c) => [
      String(c._id),
      String(c.email ?? '')
        .trim()
        .toLowerCase()
    ])
  )

  return contactIds
    .map((id) => {
      const contactId = String(id)
      const email = emailById.get(contactId) ?? ''
      return { contactId, email }
    })
    .filter((r) => r.email.includes('@'))
}
