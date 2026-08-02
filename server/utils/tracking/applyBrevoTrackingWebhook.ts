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
import {
  parseBrevoTransactionalWebhookPayload,
  resolveDbNameFromBrevoTags,
  resolveTenantIdFromBrevoTags,
  type ParsedBrevoTransactionalWebhook
} from '@server/utils/tracking/parseBrevoTransactionalWebhookPayload'

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
  const date = parsed.date.trim()
  const eventAtMs = date ? Date.parse(date) : NaN
  const tag = parsed.tag
  return {
    email: parsed.email,
    date,
    messageId: parsed.messageId,
    event: parsed.event,
    tag,
    subject: parsed.subject,
    from: parsed.from,
    ip: parsed.ip,
    link: parsed.link,
    reason: parsed.reason,
    eventAt: Number.isFinite(eventAtMs) ? new Date(eventAtMs) : null,
    campaignId: parseCampaignIdFromBrevoTag(tag),
    userEmail: parseUserEmailFromBrevoTag(tag)
  }
}

/**
 * Ingest one Brevo transactional webhook into the tenant `brevo_tracking_events` store.
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

  const result = await BrevoTrackingEvent.updateOne(
    {
      messageId: doc.messageId,
      event: doc.event,
      date: doc.date
    },
    { $set: doc },
    { upsert: true }
  )

  return {
    ok: true,
    dbName,
    upserted: Boolean(result.upsertedCount),
    messageId: doc.messageId,
    event: doc.event
  }
}
