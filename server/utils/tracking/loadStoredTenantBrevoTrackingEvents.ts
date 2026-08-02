import type { FilterQuery } from 'mongoose'
import { getTenantConnectionByDbName } from '@server/tenant/connection'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { BrevoEmailEventType } from '@server/utils/tracking/brevoEventType'
import {
  extractUserEmailsFromBrevoEvents,
  filterBrevoEventsByDateRange,
  type BrevoTrackingEmailEvent
} from '@server/utils/tracking/brevoTenantEvents'
import { parseYmdToUtcBounds } from '@server/utils/tracking/brevoTrackingEventDateBounds'

export interface LoadStoredTenantBrevoTrackingEventsOptions {
  campaignId?: string | null
  fromYmd?: string | null
  toYmd?: string | null
  tzOffsetMinutes?: number | null
  /**
   * Forced ownership scope (`null` = tenant-wide).
   * Empty array yields no events.
   */
  userEmails?: string[] | null
  /**
   * Optional UI User filter. Narrows `events` only — `tagUsers` stays the full
   * date/campaign/ownership window so the dropdown does not collapse to one email.
   */
  filterUserEmails?: string[] | null
  brevoEventTypes?: BrevoEmailEventType[] | null
}

type StoredTrackingEventLean = {
  email?: string
  date?: string
  messageId?: string
  event?: string
  tag?: string
  userEmail?: string
  subject?: string
  from?: string
  ip?: string
  link?: string
  reason?: string
}

function docToEvent(doc: StoredTrackingEventLean): BrevoTrackingEmailEvent {
  return {
    email: doc.email || undefined,
    date: doc.date || undefined,
    messageId: doc.messageId || undefined,
    event: doc.event || undefined,
    tag: doc.tag || undefined,
    subject: doc.subject || undefined,
    from: doc.from || undefined,
    ip: doc.ip || undefined,
    link: doc.link || undefined,
    reason: doc.reason || undefined
  }
}

function normalizeTagUsers(emails: string[]): string[] {
  return [
    ...new Set(
      emails.map((e) => e.trim().toLowerCase()).filter((e) => e.includes('@'))
    )
  ].sort((a, b) => a.localeCompare(b))
}

function buildEventTypeFilter(
  brevoEventTypes: BrevoEmailEventType[] | null
): string[] | null {
  if (!brevoEventTypes?.length) return null
  const types = new Set<string>(brevoEventTypes)
  if (types.has('requests')) types.add('sent')
  if (types.has('opened')) {
    types.add('unique_opened')
    types.add('open')
  }
  if (types.has('clicks')) types.add('click')
  return [...types]
}

/**
 * Read synced Brevo events from the tenant Mongo DB (no Brevo HTTP call).
 */
export async function loadStoredTenantBrevoTrackingEvents(
  dbName: string,
  options: LoadStoredTenantBrevoTrackingEventsOptions = {}
): Promise<{
  events: BrevoTrackingEmailEvent[]
  tagUsers: string[]
}> {
  const fromYmd = options.fromYmd ?? null
  const toYmd = options.toYmd ?? null
  const tzOffsetMinutes = options.tzOffsetMinutes ?? null
  const userEmails = options.userEmails === undefined ? null : options.userEmails
  const filterUserEmails =
    options.filterUserEmails === undefined ? null : options.filterUserEmails
  const campaignId = options.campaignId?.trim() || null
  const brevoEventTypes = options.brevoEventTypes?.length ? options.brevoEventTypes : null

  if (userEmails != null && userEmails.length === 0) {
    return { events: [], tagUsers: [] }
  }

  const conn = await getTenantConnectionByDbName(dbName)
  const { BrevoTrackingEvent } = getTenantClientModels(conn)

  /** Date + campaign + session ownership — used for both events and tagUsers. */
  const scopeFilter: FilterQuery<Record<string, unknown>> = {}
  if (campaignId) scopeFilter.campaignId = campaignId
  if (userEmails != null) {
    if (!userEmails.length) return { events: [], tagUsers: [] }
    scopeFilter.userEmail = { $in: userEmails.map((e) => e.trim().toLowerCase()) }
  }

  const bounds = parseYmdToUtcBounds(fromYmd, toYmd, tzOffsetMinutes)
  if (bounds) {
    scopeFilter.eventAt = { $gte: bounds.start, $lte: bounds.end }
  }

  const eventTypeValues = buildEventTypeFilter(brevoEventTypes)
  const hasOptionalUserFilter = filterUserEmails != null

  if (hasOptionalUserFilter && !filterUserEmails.length) {
    // Still need tagUsers for the dropdown; distinct is index-backed and cheap.
    const distinctUsers = (await BrevoTrackingEvent.distinct(
      'userEmail',
      scopeFilter
    )) as string[]
    return { events: [], tagUsers: normalizeTagUsers(distinctUsers) }
  }

  const eventFilter: FilterQuery<Record<string, unknown>> = { ...scopeFilter }
  if (hasOptionalUserFilter && filterUserEmails.length) {
    eventFilter.userEmail = {
      $in: filterUserEmails.map((e) => e.trim().toLowerCase())
    }
  }
  if (eventTypeValues) {
    eventFilter.event = { $in: eventTypeValues }
  }

  const eventSelect = {
    email: 1,
    date: 1,
    messageId: 1,
    event: 1,
    tag: 1,
    userEmail: 1,
    subject: 1,
    from: 1,
    ip: 1,
    link: 1,
    reason: 1,
    _id: 0
  }

  // No optional user filter: one find — derive tagUsers from the same docs (same cost as before).
  // With optional user filter: parallel distinct (cheap) + narrow events find.
  if (!hasOptionalUserFilter) {
    const docs = (await BrevoTrackingEvent.find(eventFilter)
      .select(eventSelect)
      .lean()
      .exec()) as unknown as StoredTrackingEventLean[]

    let events = docs.map(docToEvent)
    events = filterBrevoEventsByDateRange(events, fromYmd, toYmd, tzOffsetMinutes)

    const fromField = normalizeTagUsers(docs.map((d) => d.userEmail || ''))
    const tagUsers =
      fromField.length > 0
        ? fromField
        : extractUserEmailsFromBrevoEvents(events)

    return { events, tagUsers }
  }

  const [distinctUsers, docs] = await Promise.all([
    BrevoTrackingEvent.distinct('userEmail', scopeFilter) as Promise<string[]>,
    BrevoTrackingEvent.find(eventFilter)
      .select(eventSelect)
      .lean()
      .exec()
      .then((rows) => rows as unknown as StoredTrackingEventLean[])
  ])

  let events = docs.map(docToEvent)
  events = filterBrevoEventsByDateRange(events, fromYmd, toYmd, tzOffsetMinutes)

  return {
    events,
    tagUsers: normalizeTagUsers(distinctUsers)
  }
}
