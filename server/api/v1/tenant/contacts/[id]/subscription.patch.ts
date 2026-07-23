import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { ContactLean } from '@server/types/tenant/contact.model'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { syncRecipientListsForContactSubscription } from '@server/utils/recipient/syncContactRecipientListMembership'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'

type SubscriptionPatchLean = Pick<ContactLean, 'isUnsubscribe' | 'updatedAt'>

export default defineEventHandler(async (event) => {
  const rawId = getRouterParam(event, 'id')
  if (!rawId || !mongoose.isValidObjectId(rawId)) {
    throw createError({ statusCode: 400, message: 'Invalid contact id' })
  }

  const body = (await readBody(event).catch(() => null)) as { subscribed?: unknown } | null
  if (!body || typeof body.subscribed !== 'boolean') {
    throw createError({ statusCode: 400, message: 'subscribed (boolean) is required' })
  }

  const conn = await getTenantConnectionFromEvent(event)
  const { Contact } = getTenantClientModels(conn)
  const auth = event.context.auth as unknown
  const oid = new mongoose.Types.ObjectId(rawId)
  const filter = mergeTenantOwnerEmailScopeFilter(
    { _id: oid, deletedAt: null },
    auth
  )

  const updated = await Contact.findOneAndUpdate(
    filter,
    { $set: { isUnsubscribe: !body.subscribed } },
    { new: true, projection: { isUnsubscribe: 1, updatedAt: 1 } }
  ).lean<SubscriptionPatchLean | null>()

  if (!updated) {
    throw createError({ statusCode: 404, message: 'Contact not found' })
  }

  await syncRecipientListsForContactSubscription(conn, oid, body.subscribed)

  return {
    ok: true,
    id: rawId,
    subscribed: updated.isUnsubscribe !== true,
    is_unsubscribe: updated.isUnsubscribe === true,
    updatedAt: updated.updatedAt?.toISOString?.() ?? null
  }
})
