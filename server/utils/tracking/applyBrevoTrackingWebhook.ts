import { getRegistryConnection } from '@server/lib/mongoose'
import { getTenantConnectionByDbName } from '@server/tenant/connection'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import {
  findRegistryTenantByDbName,
  findRegistryTenantByTenantId
} from '@server/tenant/registry-auth'
import {
  parseCampaignIdFromBrevoTag,
  parseUserEmailFromBrevoTag
} from '@server/utils/tracking/syncTenantBrevoTrackingEvents'
import { brevoTrackingIdentityFromDate } from '@server/utils/tracking/brevoTrackingEventIdentity'
import { findProximityTrackingEvent } from '@server/utils/tracking/dedupeBrevoTrackingEvents'
import {
  parseBrevoTransactionalWebhookPayload,
  resolveDbNameFromBrevoTags,
  resolveTenantIdFromBrevoTags,
  type ParsedBrevoTransactionalWebhook
} from '@server/utils/tracking/parseBrevoTransactionalWebhookPayload'
import {
  shouldAutoUnsubscribeOnTrackingEvent,
  unsubscribeContactsOnBounce
} from '@server/utils/contact/unsubscribeContactsOnBounce'

export type ApplyBrevoTrackingWebhookResult = {
  ok: true
  dbName: string
  upserted: boolean
  messageId: string
  event: string
} | {
  ok: false
  statusCode: number
  message: string
}

export async function resolveTenantDbName(
  parsed: ParsedBrevoTransactionalWebhook
): Promise<string | null> {
  const fromDbTag = resolveDbNameFromBrevoTags(parsed.tags)
  if (fromDbTag) return fromDbTag

  const tenantId = resolveTenantIdFromBrevoTags(parsed.tags)
  if (!tenantId) return null

  const registry = await getRegistryConnection()
  const row = await findRegistryTenantByTenantId(registry, tenantId)
  return row?.dbName?.trim() || null
}

function webhookToTrackingDoc(parsed: ParsedBrevoTransactionalWebhook) {
  const identity = brevoTrackingIdentityFromDate(parsed.date)
  const tag = parsed.tag
  return {
    email: parsed.email,
    date: identity.date || parsed.date.trim(),
    messageId: parsed.messageId,
    event: parsed.event,
    tag,
    subject: parsed.subject,
    from: parsed.from,
    ip: parsed.ip,
    link: parsed.link,
    reason: parsed.reason,
    eventAt: identity.eventAt,
    eventKeyAt: identity.eventKeyAt,
    campaignId: parseCampaignIdFromBrevoTag(tag),
    userEmail: parseUserEmailFromBrevoTag(tag)
  }
}

async function maybeAutoUnsubscribeOnBounce(
  conn: Awaited<ReturnType<typeof getTenantConnectionByDbName>>,
  doc: ReturnType<typeof webhookToTrackingDoc>,
  dbName: string
): Promise<void> {
  if (!shouldAutoUnsubscribeOnTrackingEvent(doc.event) || !doc.email?.trim()) return
  try {
    await unsubscribeContactsOnBounce(conn, {
      email: doc.email,
      reason: doc.event,
      messageId: doc.messageId
    })
  } catch (err) {
    console.warn('[applyBrevoTrackingWebhook] auto-unsubscribe on bounce failed', {
      dbName,
      email: doc.email,
      event: doc.event,
      messageId: doc.messageId,
      err
    })
  }
}

/**
 * Ingest one Brevo transactional webhook into the tenant `brevo_tracking_events` store.
 * Hard bounces and spam complaints also auto-unsubscribe matching contacts.
 */
export async function applyBrevoTrackingWebhook(
  body: unknown
): Promise<ApplyBrevoTrackingWebhookResult> {
  const parsed = parseBrevoTransactionalWebhookPayload(body)
  if (!parsed) {
    return {
      ok: false,
      statusCode: 400,
      message: 'Could not parse Brevo webhook payload'
    }
  }

  const dbName = await resolveTenantDbName(parsed)
  if (!dbName) {
    return {
      ok: false,
      statusCode: 404,
      message: 'Could not resolve tenant from webhook tags (need db: or tenant:)'
    }
  }

  // Confirm the db exists in the registry when possible (skip orphans).
  try {
    const registry = await getRegistryConnection()
    const row = await findRegistryTenantByDbName(registry, dbName)
    if (!row) {
      return {
        ok: false,
        statusCode: 404,
        message: `Unknown tenant database: ${dbName}`
      }
    }
  } catch {
    // Registry unavailable — still attempt tenant DB if connection works.
  }

  const conn = await getTenantConnectionByDbName(dbName)
  const { BrevoTrackingEvent } = getTenantClientModels(conn)
  const doc = webhookToTrackingDoc(parsed)

  if (doc.eventKeyAt != null) {
    const existing = await findProximityTrackingEvent(BrevoTrackingEvent, {
      messageId: doc.messageId,
      event: doc.event,
      eventKeyAt: doc.eventKeyAt
    })
    if (existing?._id) {
      const result = await BrevoTrackingEvent.updateOne(
        { _id: existing._id },
        {
          $set: {
            ...doc,
            // Keep richer non-empty fields already on the row when incoming is blank.
            from: doc.from || existing.from || '',
            tag: doc.tag || existing.tag || '',
            subject: doc.subject || existing.subject || '',
            email: doc.email || existing.email || ''
          }
        }
      )
      await maybeAutoUnsubscribeOnBounce(conn, doc, dbName)
      return {
        ok: true,
        dbName,
        upserted: Boolean(result.upsertedCount),
        messageId: doc.messageId,
        event: doc.event
      }
    }
  }

  const result = await BrevoTrackingEvent.updateOne(
    {
      messageId: doc.messageId,
      event: doc.event,
      ...(doc.eventKeyAt != null ? { eventKeyAt: doc.eventKeyAt } : { date: doc.date })
    },
    { $set: doc },
    { upsert: true }
  )

  await maybeAutoUnsubscribeOnBounce(conn, doc, dbName)

  return {
    ok: true,
    dbName,
    upserted: Boolean(result.upsertedCount),
    messageId: doc.messageId,
    event: doc.event
  }
}
