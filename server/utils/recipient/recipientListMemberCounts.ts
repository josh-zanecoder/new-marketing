import mongoose from 'mongoose'
import type { getTenantClientModels } from '@server/models/tenant/tenantClientModels'

type RecipientListMemberModel = ReturnType<typeof getTenantClientModels>['RecipientListMember']
type ContactModel = ReturnType<typeof getTenantClientModels>['Contact']

/** Count list members whose contacts still match the tenant visibility / marketable filter. */
export async function countVisibleMembersByListId(params: {
  RecipientListMember: RecipientListMemberModel
  Contact: ContactModel
  listObjectIds: mongoose.Types.ObjectId[]
  contactFilter: Record<string, unknown>
}) {
  const memberCountByListId = new Map<string, number>()
  if (params.listObjectIds.length === 0) return memberCountByListId

  const members = (await params.RecipientListMember.find({
    recipientListId: { $in: params.listObjectIds }
  })
    .select({ recipientListId: 1, contactId: 1 })
    .lean()
    .exec()) as Array<{ recipientListId?: unknown; contactId?: unknown }>

  if (!members.length) return memberCountByListId

  const contactIds = [
    ...new Set(
      members
        .map((m) => m.contactId)
        .filter((id) => id != null && mongoose.isValidObjectId(String(id)))
        .map((id) => new mongoose.Types.ObjectId(String(id)))
    )
  ]

  if (!contactIds.length) return memberCountByListId

  const validContactRows = await params.Contact.find({
    ...params.contactFilter,
    _id: { $in: contactIds }
  })
    .select({ _id: 1 })
    .lean()
    .exec()

  const validContactIds = new Set(validContactRows.map((c) => String(c._id)))

  for (const m of members) {
    const contactId = String(m.contactId ?? '')
    if (!validContactIds.has(contactId)) continue
    const listId = String(m.recipientListId ?? '')
    memberCountByListId.set(listId, (memberCountByListId.get(listId) ?? 0) + 1)
  }

  return memberCountByListId
}

export async function countVisibleMembersForList(params: {
  RecipientListMember: RecipientListMemberModel
  Contact: ContactModel
  listId: mongoose.Types.ObjectId
  contactFilter: Record<string, unknown>
}) {
  const counts = await countVisibleMembersByListId({
    RecipientListMember: params.RecipientListMember,
    Contact: params.Contact,
    listObjectIds: [params.listId],
    contactFilter: params.contactFilter
  })
  return counts.get(String(params.listId)) ?? 0
}
