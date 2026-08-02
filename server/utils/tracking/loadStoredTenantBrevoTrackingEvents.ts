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
  userEmails?: string[] | null
  filterUserEmails?: string[] | null
  brevoEventTypes?: BrevoEmailEventType[] | null
}

function docToEvent(doc: {
  email?: string
  date?: string
  messageId?: string
  event?: string
  tag?: string
}): BrevoTrackingEmailEvent {
  return {
    email: doc.email || undefined,
    date: doc.date || undefined,
    messageId: doc.messageId || undefined,
    event: doc.event || undefined,
    tag: doc.tag || undefined
  }
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

  const ownershipEmails =
    filterUserEmails != null && filterUserEmails.length
      ? filterUserEmails
      : userEmails

  const baseFilter: FilterQuery<Record<string, unknown>> = {}
  if (campaignId) baseFilter.campaignId = campaignId
  if (ownershipEmails != null) {
    if (!ownershipEmails.length) return { events: [], tagUsers: [] }
    baseFilter.userEmail = { $in: ownershipEmails.map((e) => e.trim().toLowerCase()) }
  }

  const bounds = parseYmdToUtcBounds(fromYmd, toYmd, tzOffsetMinutes)
  if (bounds) {
    baseFilter.eventAt = { $gte: bounds.start, $lte: bounds.end }
  }

  const eventFilter: FilterQuery<Record<string, unknown>> = { ...baseFilter }
  if (brevoEventTypes?.length) {
    // Include common UI aliases stored from Brevo payloads.
    const types = new Set<string>(brevoEventTypes)
    if (types.has('requests')) types.add('sent')
    if (types.has('opened')) {
      types.add('unique_opened')
      types.add('open')
    }
    if (types.has('clicks')) types.add('click')
    eventFilter.event = { $in: [...types] }
  }

  const docs = await BrevoTrackingEvent.find(eventFilter)
    .select({ email: 1, date: 1, messageId: 1, event: 1, tag: 1, _id: 0 })
    .lean()
    .exec()

  let events = (docs as Array<Record<string, string>>).map(docToEvent)
  events = filterBrevoEventsByDateRange(events, fromYmd, toYmd, tzOffsetMinutes)

  // tagUsers: distinct users in the date/campaign/ownership window (all event types).
  const tagUserDocs = await BrevoTrackingEvent.find(baseFilter)
    .select({ userEmail: 1, tag: 1, _id: 0 })
    .lean()
    .exec()
  const tagUsersFromField = [
    ...new Set(
      (tagUserDocs as Array<{ userEmail?: string }>)
        .map((d) => (d.userEmail || '').trim().toLowerCase())
        .filter((e) => e.includes('@'))
    )
  ].sort((a, b) => a.localeCompare(b))

  const tagUsers =
    tagUsersFromField.length > 0
      ? tagUsersFromField
      : extractUserEmailsFromBrevoEvents(
          (tagUserDocs as Array<{ tag?: string }>).map((d) => ({ tag: d.tag }))
        )

  if (filterUserEmails != null && !filterUserEmails.length) {
    return { events: [], tagUsers }
  }

  return { events, tagUsers }
}
