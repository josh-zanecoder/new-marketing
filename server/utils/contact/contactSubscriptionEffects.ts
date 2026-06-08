import type { Connection } from 'mongoose'
import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { syncContactRecipientListMembership } from '@server/utils/recipient/syncContactRecipientListMembership'

const SNAPSHOT_META_KEY = 'unsubscribeRecipientListIds'

function readSnapshotListIds(metadata: unknown): mongoose.Types.ObjectId[] {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return []
  const raw = (metadata as Record<string, unknown>)[SNAPSHOT_META_KEY]
  if (!Array.isArray(raw)) return []
  const ids: mongoose.Types.ObjectId[] = []
  for (const item of raw) {
    if (typeof item === 'string' && mongoose.isValidObjectId(item)) {
      ids.push(new mongoose.Types.ObjectId(item))
    }
  }
  return ids
}

/** Remove contact from all lists; keep static list ids so re-subscribe can restore them. */
export async function onContactUnsubscribed(
  tenantConn: Connection,
  contactId: mongoose.Types.ObjectId
): Promise<void> {
  const { Contact, RecipientList, RecipientListMember } = getTenantClientModels(tenantConn)

  const members = await RecipientListMember.find({ contactId })
    .select('recipientListId')
    .lean<{ recipientListId?: mongoose.Types.ObjectId }[]>()

  if (members.length) {
    const listIds = [...new Set(members.map((m) => String(m.recipientListId)).filter(Boolean))]
    const staticLists = await RecipientList.find({
      _id: { $in: listIds },
      listType: 'static'
    })
      .select('_id')
      .lean<{ _id: mongoose.Types.ObjectId }[]>()

    const staticIds = staticLists.map((l) => String(l._id))
    if (staticIds.length) {
      await Contact.updateOne(
        { _id: contactId, deletedAt: null },
        { $set: { [`metadata.${SNAPSHOT_META_KEY}`]: staticIds } }
      )
    }
  }

  await RecipientListMember.deleteMany({ contactId })
}

/** Re-add to static lists from snapshot and refresh dynamic/hybrid membership. */
export async function onContactSubscribed(
  tenantConn: Connection,
  contactId: mongoose.Types.ObjectId
): Promise<void> {
  const { Contact, RecipientList, RecipientListMember } = getTenantClientModels(tenantConn)

  const contact = await Contact.findOne({ _id: contactId, deletedAt: null })
    .select(`metadata.${SNAPSHOT_META_KEY}`)
    .lean<{ metadata?: Record<string, unknown> } | null>()

  if (!contact) return

  const snapshotIds = readSnapshotListIds(contact.metadata)
  if (snapshotIds.length) {
    const existingStatic = await RecipientList.find({
      _id: { $in: snapshotIds },
      listType: 'static'
    })
      .select('_id')
      .lean<{ _id: mongoose.Types.ObjectId }[]>()

    for (const list of existingStatic) {
      await RecipientListMember.updateOne(
        { recipientListId: list._id, contactId },
        { $setOnInsert: { recipientListId: list._id, contactId } },
        { upsert: true }
      )
    }

    await Contact.updateOne(
      { _id: contactId },
      { $unset: { [`metadata.${SNAPSHOT_META_KEY}`]: '' } }
    )
  }

  await syncContactRecipientListMembership(tenantConn, contactId)
}
