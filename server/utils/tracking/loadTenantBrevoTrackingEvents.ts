import { fetchTenantBrevoEmailEvents } from '@server/utils/tracking/fetchTenantBrevoEmailEvents'
import {
  eventTagMatchesUsers,
  extractUserEmailsFromBrevoEvents,
  filterBrevoEventsByDateRange,
  filterBrevoEventsForTenant,
  type BrevoTrackingEmailEvent
} from '@server/utils/tracking/brevoTenantEvents'

export interface LoadTenantBrevoTrackingEventsOptions {
  campaignId?: string | null
  fromYmd?: string | null
  toYmd?: string | null
  /** Browser `Date#getTimezoneOffset()` for local-day filtering. */
  tzOffsetMinutes?: number | null
  /**
   * Forced ownership scope (`null` = tenant-wide).
   * Empty array yields no events.
   */
  userEmails?: string[] | null
  /**
   * Optional extra narrow (tenant-wide user picker). Applied after ownership
   * so `tagUsers` still lists everyone visible under ownership.
   */
  filterUserEmails?: string[] | null
}

export async function loadTenantBrevoTrackingEvents(
  dbName: string,
  marketingTenantId: string | null,
  options: LoadTenantBrevoTrackingEventsOptions = {}
): Promise<{
  events: BrevoTrackingEmailEvent[]
  tagUsers: string[]
  error?: string
}> {
  const fromYmd = options.fromYmd ?? null
  const toYmd = options.toYmd ?? null
  const tzOffsetMinutes = options.tzOffsetMinutes ?? null
  const userEmails = options.userEmails === undefined ? null : options.userEmails
  const filterUserEmails =
    options.filterUserEmails === undefined ? null : options.filterUserEmails
  const campaignId = options.campaignId ?? null

  if (userEmails != null && userEmails.length === 0) {
    return { events: [], tagUsers: [] }
  }

  const { events: rawEvents, error } = await fetchTenantBrevoEmailEvents({
    fromYmd,
    toYmd,
    dbName,
    campaignId
  })
  if (error) {
    return { events: [], tagUsers: [], error }
  }

  let events = filterBrevoEventsForTenant(rawEvents, {
    dbName,
    marketingTenantId,
    campaignId,
    userEmails
  })

  events = filterBrevoEventsByDateRange(events, fromYmd, toYmd, tzOffsetMinutes)

  const tagUsers = extractUserEmailsFromBrevoEvents(events)

  if (filterUserEmails != null) {
    if (!filterUserEmails.length) {
      return { events: [], tagUsers }
    }
    events = events.filter((item) => eventTagMatchesUsers(item.tag, filterUserEmails))
  }

  return { events, tagUsers }
}
