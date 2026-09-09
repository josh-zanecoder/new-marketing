import type { AnyBulkWriteOperation } from 'mongoose'
import { getTenantConnectionByDbName } from '@server/tenant/connection'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { fetchTenantBrevoEmailEvents } from '@server/utils/tracking/fetchTenantBrevoEmailEvents'
import {
  filterBrevoEventsForTenant,
  parseTagSegments,
  type BrevoTrackingEmailEvent
} from '@server/utils/tracking/brevoTenantEvents'
import { brevoTrackingIdentityFromDate } from '@server/utils/tracking/brevoTrackingEventIdentity'
import {
  dedupeBrevoTrackingEvents,
  ensureBrevoTrackingIndexes
} from '@server/utils/tracking/dedupeBrevoTrackingEvents'

const BULK_CHUNK = 1000

/** Coalesce concurrent full syncs for the same campaign/range (UI often fires 2×). */
const inflightSyncs = new Map<string, Promise<SyncTenantBrevoTrackingEventsResult>>()

export function parseCampaignIdFromBrevoTag(tag: string | undefined): string {
  for (const part of parseTagSegments(tag)) {
    if (part.toLowerCase().startsWith('campaign:')) {
      return part.slice('campaign:'.length).trim()
    }
  }
  return ''
}

export function parseUserEmailFromBrevoTag(tag: string | undefined): string {
  for (const part of parseTagSegments(tag)) {
    if (!part.toLowerCase().startsWith('user:')) continue
    const value = part.slice('user:'.length).trim().toLowerCase()
    if (value.includes('@')) return value
  }
  return ''
}

export function brevoEventToTrackingDoc(ev: BrevoTrackingEmailEvent) {
  const rawDate = (ev.date || '').trim()
  const messageId = (ev.messageId || '').trim()
  const event = (ev.event || '').trim()
  const tag = (ev.tag || '').trim()
  const email = (ev.email || '').trim()
  const identity = brevoTrackingIdentityFromDate(rawDate)
  return {
    email,
    date: identity.date || rawDate,
    messageId,
    event,
    tag,
    subject: (ev.subject || '').trim(),
    from: (ev.from || '').trim(),
    ip: (ev.ip || '').trim(),
    link: (ev.link || '').trim(),
    reason: (ev.reason || '').trim(),
    eventAt: identity.eventAt,
    eventKeyAt: identity.eventKeyAt,
    campaignId: parseCampaignIdFromBrevoTag(tag),
    userEmail: parseUserEmailFromBrevoTag(tag)
  }
}

export type SyncTenantBrevoTrackingEventsResult = {
  fetched: number
  upserted: number
  modified: number
  deduped?: number
  timingsMs?: {
    brevoFetch?: number
    upsert?: number
    dedupe?: number
    total: number
  }
  error?: string
  /** Present on zcMail sync so Refresh Network tab can diagnose empty Tracking. */
  debug?: ZcMailTrackingSyncDebug
}

export type ZcMailTrackingSyncDebug = {
  campaignId: string | null
  fromYmd: string | null
  toYmd: string | null
  zcMailTenant: string
  usedTenantListFallback: boolean
  campaignRecipientMessageIds: number
  listed: number
  matched: number
  scoped: number
  routingHits: number
  sampleRecipientMessageIds: string[]
  sampleListed: Array<{
    id: string
    messageId: string
    sesMessageId: string
    recipient: string
    status: string
    createdAt: string
    tags: Record<string, string>
    inRecipientIndex: boolean
    routingCampaignId: string | null
  }>
}

function syncKey(params: {
  dbName: string
  campaignId?: string | null
  fromYmd?: string | null
  toYmd?: string | null
}): string {
  return [
    params.dbName.trim(),
    params.campaignId?.trim() || '',
    params.fromYmd?.trim() || '',
    params.toYmd?.trim() || ''
  ].join('|')
}

/**
 * Full Brevo events pull → fast Mongo bulkWrite → one proximity dedupe pass.
 *
 * Webhooks stay the live path. Sync still fetches the full UI date range from Brevo
 * (gap-fill), but must NOT do per-event findOne (that made Refresh multi‑minute).
 */
export async function syncTenantBrevoTrackingEvents(params: {
  dbName: string
  marketingTenantId?: string | null
  fromYmd?: string | null
  toYmd?: string | null
  campaignId?: string | null
}): Promise<SyncTenantBrevoTrackingEventsResult> {
  const dbName = params.dbName.trim()
  if (!dbName) {
    return { fetched: 0, upserted: 0, modified: 0, timingsMs: { total: 0 }, error: 'Missing tenant database' }
  }

  const key = syncKey({
    dbName,
    campaignId: params.campaignId,
    fromYmd: params.fromYmd,
    toYmd: params.toYmd
  })
  const existing = inflightSyncs.get(key)
  if (existing) return existing

  const promise = runFullBrevoSync(params).finally(() => {
    inflightSyncs.delete(key)
  })
  inflightSyncs.set(key, promise)
  return promise
}

async function runFullBrevoSync(params: {
  dbName: string
  marketingTenantId?: string | null
  fromYmd?: string | null
  toYmd?: string | null
  campaignId?: string | null
}): Promise<SyncTenantBrevoTrackingEventsResult> {
  const started = Date.now()
  const dbName = params.dbName.trim()

  const t0 = Date.now()
  const { events: rawEvents, error } = await fetchTenantBrevoEmailEvents({
    fromYmd: params.fromYmd ?? null,
    toYmd: params.toYmd ?? null,
    dbName,
    campaignId: params.campaignId ?? null,
    skipCache: true
  })
  const brevoFetchMs = Date.now() - t0

  if (error) {
    return {
      fetched: 0,
      upserted: 0,
      modified: 0,
      timingsMs: { brevoFetch: brevoFetchMs, total: Date.now() - started },
      error
    }
  }

  const events = filterBrevoEventsForTenant(rawEvents, {
    dbName,
    marketingTenantId: params.marketingTenantId ?? null,
    campaignId: params.campaignId ?? null,
    userEmails: null
  })

  const usable = events.filter(
    (ev) => (ev.messageId || '').trim() && (ev.event || '').trim() && (ev.date || '').trim()
  )

  const conn = await getTenantConnectionByDbName(dbName)
  const { BrevoTrackingEvent } = getTenantClientModels(conn)
  await ensureBrevoTrackingIndexes(BrevoTrackingEvent)

  let upserted = 0
  let modified = 0
  const t1 = Date.now()
  for (let i = 0; i < usable.length; i += BULK_CHUNK) {
    const slice = usable.slice(i, i + BULK_CHUNK)
    const ops: AnyBulkWriteOperation[] = slice.map((ev) => {
      const doc = brevoEventToTrackingDoc(ev)
      const filter =
        doc.eventKeyAt != null
          ? { messageId: doc.messageId, event: doc.event, eventKeyAt: doc.eventKeyAt }
          : { messageId: doc.messageId, event: doc.event, date: doc.date }
      return {
        updateOne: {
          filter,
          update: { $set: doc },
          upsert: true
        }
      }
    })
    const result = await BrevoTrackingEvent.bulkWrite(ops, { ordered: false })
    upserted += result.upsertedCount ?? 0
    modified += result.modifiedCount ?? 0
  }
  const upsertMs = Date.now() - t1

  // Collapse webhook↔API copies. Funnel stats also count distinct messageId as a safety net.
  const t2 = Date.now()
  const dedupe = await dedupeBrevoTrackingEvents(BrevoTrackingEvent, {
    campaignId: params.campaignId ?? null
  })
  const dedupeMs = Date.now() - t2
  const total = Date.now() - started

  console.info('[tracking.sync]', {
    campaignId: params.campaignId ?? null,
    fetched: usable.length,
    upserted,
    modified,
    deduped: dedupe.removed,
    timingsMs: { brevoFetch: brevoFetchMs, upsert: upsertMs, dedupe: dedupeMs, total }
  })

  return {
    fetched: usable.length,
    upserted,
    modified,
    deduped: dedupe.removed,
    timingsMs: { brevoFetch: brevoFetchMs, upsert: upsertMs, dedupe: dedupeMs, total }
  }
}
