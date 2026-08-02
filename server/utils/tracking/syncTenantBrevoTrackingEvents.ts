import type { AnyBulkWriteOperation } from 'mongoose'
import { getTenantConnectionByDbName } from '@server/tenant/connection'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { fetchTenantBrevoEmailEvents } from '@server/utils/tracking/fetchTenantBrevoEmailEvents'
import {
  filterBrevoEventsForTenant,
  parseTagSegments,
  type BrevoTrackingEmailEvent
} from '@server/utils/tracking/brevoTenantEvents'

const BULK_CHUNK = 500

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
  const date = (ev.date || '').trim()
  const messageId = (ev.messageId || '').trim()
  const event = (ev.event || '').trim()
  const tag = (ev.tag || '').trim()
  const email = (ev.email || '').trim()
  const eventAtMs = date ? Date.parse(date) : NaN
  return {
    email,
    date,
    messageId,
    event,
    tag,
    subject: (ev.subject || '').trim(),
    from: (ev.from || '').trim(),
    ip: (ev.ip || '').trim(),
    link: (ev.link || '').trim(),
    reason: (ev.reason || '').trim(),
    eventAt: Number.isFinite(eventAtMs) ? new Date(eventAtMs) : null,
    campaignId: parseCampaignIdFromBrevoTag(tag),
    userEmail: parseUserEmailFromBrevoTag(tag)
  }
}

export type SyncTenantBrevoTrackingEventsResult = {
  fetched: number
  upserted: number
  modified: number
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
    // intentionally no `events` filter — refresh stores the full window
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

  let upserted = 0
  let modified = 0

  const usable = events.filter(
    (ev) => (ev.messageId || '').trim() && (ev.event || '').trim() && (ev.date || '').trim()
  )

  for (let i = 0; i < usable.length; i += BULK_CHUNK) {
    const slice = usable.slice(i, i + BULK_CHUNK)
    const ops: AnyBulkWriteOperation[] = slice.map((ev) => {
      const doc = brevoEventToTrackingDoc(ev)
      return {
        updateOne: {
          filter: {
            messageId: doc.messageId,
            event: doc.event,
            date: doc.date
          },
          update: { $set: doc },
          upsert: true
        }
      }
    })
    const result = await BrevoTrackingEvent.bulkWrite(ops, { ordered: false })
    upserted += result.upsertedCount ?? 0
    modified += result.modifiedCount ?? 0
  }

  return { fetched: usable.length, upserted, modified }
}
