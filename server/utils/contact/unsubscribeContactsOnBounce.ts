import type { Connection, Types } from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { normalizeBulkUnsubscribeEmail } from '@server/utils/contact/bulkUnsubscribeContactsByEmail'
import { onContactUnsubscribed } from '@server/utils/contact/contactSubscriptionEffects'

/**
 * Tracking event names that should flip `Contact.isUnsubscribe` (webhook ingest only).
 * Includes `bounces` because zcMail/SES webhooks normalize SES `Bounce` → `bounces`
 * (archive Refresh maps the same to `hardBounces`).
 */
export const AUTO_UNSUBSCRIBE_TRACKING_EVENTS = new Set([
  'hardBounces',
  'bounces',
  'bounced',
  'spam'
])

export function shouldAutoUnsubscribeOnTrackingEvent(event: string): boolean {
  return AUTO_UNSUBSCRIBE_TRACKING_EVENTS.has(String(event || '').trim())
}

export type UnsubscribeContactsOnBounceResult = {
  updated: number
  alreadyUnsubscribed: number
  notFound: boolean
  skipped: boolean
}

/**
 * Mark matching non-deleted contacts unsubscribed after a hard bounce / spam complaint.
 * Reuses the same list side effects as manual / bulk unsubscribe.
 */
export async function unsubscribeContactsOnBounce(
  tenantConn: Connection,
  params: {
    email: string
    reason: string
    messageId?: string
  }
): Promise<UnsubscribeContactsOnBounceResult> {
  const email = normalizeBulkUnsubscribeEmail(params.email)
  if (!email) {
    return { updated: 0, alreadyUnsubscribed: 0, notFound: true, skipped: true }
  }

  if (!shouldAutoUnsubscribeOnTrackingEvent(params.reason)) {
    return { updated: 0, alreadyUnsubscribed: 0, notFound: false, skipped: true }
  }

  const { Contact } = getTenantClientModels(tenantConn)
  const contacts = (await Contact.find({
    email,
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }]
  })
    .select({ _id: 1, isUnsubscribe: 1 })
    .lean()
    .exec()) as Array<{
    _id: Types.ObjectId
    isUnsubscribe?: boolean
  }>

  if (!contacts.length) {
    return { updated: 0, alreadyUnsubscribed: 0, notFound: true, skipped: false }
  }

  let updated = 0
  let alreadyUnsubscribed = 0
  const unsubscribeAt = new Date().toISOString()
  const messageId = String(params.messageId || '').trim()

  for (const contact of contacts) {
    if (contact.isUnsubscribe === true) {
      alreadyUnsubscribed += 1
      continue
    }

    await Contact.updateOne(
      { _id: contact._id },
      {
        $set: {
          isUnsubscribe: true,
          'metadata.unsubscribeSource': params.reason,
          'metadata.unsubscribeAt': unsubscribeAt,
          ...(messageId ? { 'metadata.bounceMessageId': messageId } : {})
        }
      }
    )
    await onContactUnsubscribed(tenantConn, contact._id)
    updated += 1
  }

  return { updated, alreadyUnsubscribed, notFound: false, skipped: false }
}
