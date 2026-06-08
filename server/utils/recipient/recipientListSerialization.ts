import mongoose from 'mongoose'
import { normalizeRecipientListDoc } from '@server/utils/recipient/recipientListNormalization'
import { recipientListStoredMembershipEmails } from '@server/utils/recipient/recipientListMutation'

export type RecipientListLeanDoc = {
  _id: unknown
  name?: string
  listType?: string
  createdAt?: Date | null
  updatedAt?: Date | null
} & Record<string, unknown>

export function recipientListObjectIds(lists: RecipientListLeanDoc[]): mongoose.Types.ObjectId[] {
  return lists
    .map((d) => d._id)
    .filter((id) => id != null && mongoose.isValidObjectId(String(id)))
    .map((id) => new mongoose.Types.ObjectId(String(id)))
}

export function serializeRecipientListNameOptions(lists: RecipientListLeanDoc[]) {
  return lists.map((d) => ({
    id: String(d._id),
    name: d.name ?? ''
  }))
}

export function serializeRecipientListRows(
  lists: RecipientListLeanDoc[],
  memberCountByListId: Map<string, number>
) {
  return lists.map((doc) => {
    const { audience, filters, filterMode, criterionJoins } = normalizeRecipientListDoc(doc)
    return {
      id: String(doc._id),
      name: doc.name ?? '',
      listType: doc.listType ?? '',
      audience,
      filters,
      filterMode,
      criterionJoins: criterionJoins ?? [],
      membershipScope:
        doc.membershipScope === 'tenant' || doc.membershipScope === 'owner_emails'
          ? doc.membershipScope
          : 'owner_emails',
      membershipOwnerEmails: recipientListStoredMembershipEmails(
        doc as { membershipOwnerEmails?: unknown }
      ),
      memberCount: memberCountByListId.get(String(doc._id)) ?? 0,
      createdAt: doc.createdAt?.toISOString?.() ?? null,
      updatedAt: doc.updatedAt?.toISOString?.() ?? null
    }
  })
}
