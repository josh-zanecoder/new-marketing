import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { ContactLean } from '@server/types/tenant/contact.model'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import {
  onContactSubscribed,
  onContactUnsubscribed
} from '@server/utils/contact/contactSubscriptionEffects'
import { normalizeMarketingEmail } from '@server/helpers/marketingEmail'
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

  const current = await Contact.findOne(filter)
    .select('email')
    .lean<{ email?: string } | null>()

  if (!current) {
    throw createError({ statusCode: 404, message: 'Contact not found' })
  }

  const email = normalizeMarketingEmail(current.email)
  const identityFilter = email
    ? mergeTenantOwnerEmailScopeFilter({ email, deletedAt: null }, auth)
    : filter

  await Contact.updateMany(identityFilter, { $set: { isUnsubscribe: !body.subscribed } })

  const affected = await Contact.find(identityFilter)
    .select('_id')
    .lean<Array<{ _id: mongoose.Types.ObjectId }>>()

  for (const doc of affected) {
    if (body.subscribed) {
      await onContactSubscribed(conn, doc._id)
    } else {
      await onContactUnsubscribed(conn, doc._id)
    }
  }

  const updated = await Contact.findOne(filter)
    .select('isUnsubscribe updatedAt')
    .lean<SubscriptionPatchLean | null>()

  if (!updated) {
    throw createError({ statusCode: 404, message: 'Contact not found' })
  }

  return {
    ok: true,
    id: rawId,
    subscribed: updated.isUnsubscribe !== true,
    is_unsubscribe: updated.isUnsubscribe === true,
    updatedAt: updated.updatedAt?.toISOString?.() ?? null
  }
})
