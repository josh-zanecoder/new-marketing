import type { Model } from 'mongoose'
import { getTenantConnectionByDbName } from '@server/tenant/connection'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { fetchTenantBrevoEmailEvents } from '@server/utils/tracking/fetchTenantBrevoEmailEvents'
import {
  filterBrevoEventsForTenant,
  parseTagSegments,
  type BrevoTrackingEmailEvent
} from '@server/utils/tracking/brevoTenantEvents'
import {
  brevoTrackingIdentityFromDate,
  preferRicherBrevoEventAtMs
} from '@server/utils/tracking/brevoTrackingEventIdentity'
import {
  dedupeBrevoTrackingEvents,
  findProximityTrackingEvent
} from '@server/utils/tracking/dedupeBrevoTrackingEvents'

const UPSERT_CONCURRENCY = 40

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

type TrackingDoc = ReturnType<typeof brevoEventToTrackingDoc>

function mergeWithExisting(
  incoming: TrackingDoc,
  existing: { eventKeyAt?: number | null; date?: string; from?: string }
): TrackingDoc {
  const richerMs = preferRicherBrevoEventAtMs(incoming.eventKeyAt, existing.eventKeyAt ?? null)
  const date =
    richerMs != null ? new Date(richerMs).toISOString() : incoming.date || existing.date || ''
  return {
    ...incoming,
    date,
    eventAt: richerMs != null ? new Date(richerMs) : incoming.eventAt,
    eventKeyAt: richerMs,
    from: incoming.from || (existing.from || '').trim(),
    tag: incoming.tag || '',
    subject: incoming.subject || '',
    email: incoming.email || ''
  }
}

async function upsertTrackingDoc(
  BrevoTrackingEvent: Model<unknown>,
  doc: TrackingDoc
): Promise<'upserted' | 'modified'> {
  if (doc.eventKeyAt != null) {
    const existing = await findProximityTrackingEvent(BrevoTrackingEvent, {
      messageId: doc.messageId,
      event: doc.event,
      eventKeyAt: doc.eventKeyAt
    })
    if (existing?._id) {
      const merged = mergeWithExisting(doc, existing)
      await BrevoTrackingEvent.updateOne({ _id: existing._id }, { $set: merged })
      return 'modified'
    }
  }

  await BrevoTrackingEvent.updateOne(
    {
      messageId: doc.messageId,
      event: doc.event,
      ...(doc.eventKeyAt != null ? { eventKeyAt: doc.eventKeyAt } : { date: doc.date })
    },
    { $set: doc },
    { upsert: true }
  )
  return 'upserted'
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<'upserted' | 'modified'>
): Promise<{ upserted: number; modified: number }> {
  let upserted = 0
  let modified = 0
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      const item = items[idx]
      if (item === undefined) return
      const kind = await fn(item)
      if (kind === 'upserted') upserted += 1
      else modified += 1
    }
  }
  const n = Math.max(1, Math.min(concurrency, items.length || 1))
  await Promise.all(Array.from({ length: n }, () => worker()))
  return { upserted, modified }
}

export type SyncTenantBrevoTrackingEventsResult = {
  fetched: number
  upserted: number
  modified: number
  deduped?: number
  error?: string
}

/**
 * Pull Brevo events for the date range (all event types) and upsert into the tenant DB.
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
    return { fetched: 0, upserted: 0, modified: 0, error: 'Missing tenant database' }
  }

  const { events: rawEvents, error } = await fetchTenantBrevoEmailEvents({
    fromYmd: params.fromYmd ?? null,
    toYmd: params.toYmd ?? null,
    dbName,
    campaignId: params.campaignId ?? null,
    skipCache: true
  })

  if (error) {
    return { fetched: 0, upserted: 0, modified: 0, error }
  }

  const events = filterBrevoEventsForTenant(rawEvents, {
    dbName,
    marketingTenantId: params.marketingTenantId ?? null,
    campaignId: params.campaignId ?? null,
    userEmails: null
  })

  const conn = await getTenantConnectionByDbName(dbName)
  const { BrevoTrackingEvent } = getTenantClientModels(conn)

  for (const name of [
    'messageId_1_event_1_date_1',
    'messageId_event_eventKeyAt_unique'
  ]) {
    try {
      await BrevoTrackingEvent.collection.dropIndex(name)
    } catch {
      // missing
    }
  }
  try {
    await BrevoTrackingEvent.syncIndexes()
  } catch {
    // ignore index race
  }

  const before = await dedupeBrevoTrackingEvents(BrevoTrackingEvent, {
    campaignId: params.campaignId ?? null
  })

  const usable = events.filter(
    (ev) => (ev.messageId || '').trim() && (ev.event || '').trim() && (ev.date || '').trim()
  )

  const { upserted, modified } = await mapPool(usable, UPSERT_CONCURRENCY, async (ev) =>
    upsertTrackingDoc(BrevoTrackingEvent, brevoEventToTrackingDoc(ev))
  )

  const after = await dedupeBrevoTrackingEvents(BrevoTrackingEvent, {
    campaignId: params.campaignId ?? null
  })

  return {
    fetched: usable.length,
    upserted,
    modified,
    deduped: before.removed + after.removed
  }
}
