import { fetchTenantBrevoEmailEvents } from '@server/utils/tracking/fetchTenantBrevoEmailEvents'
import {
  filterBrevoEventsByDateRange,
  filterBrevoEventsForTenant,
  type BrevoTrackingEmailEvent
} from '@server/utils/tracking/brevoTenantEvents'

export interface LoadTenantBrevoTrackingEventsOptions {
  campaignId?: string | null
  fromYmd?: string | null
  toYmd?: string | null
  /**
   * `null` = tenant-wide. Non-null = filter by Brevo `user:` tags.
   * Empty array yields no events.
   */
  userEmails?: string[] | null
}

export async function loadTenantBrevoTrackingEvents(
  dbName: string,
  marketingTenantId: string | null,
  options: LoadTenantBrevoTrackingEventsOptions = {}
): Promise<{ events: BrevoTrackingEmailEvent[]; error?: string }> {
  const fromYmd = options.fromYmd ?? null
  const toYmd = options.toYmd ?? null
  const userEmails = options.userEmails === undefined ? null : options.userEmails
  const campaignId = options.campaignId ?? null

  if (userEmails != null && userEmails.length === 0) {
    return { events: [] }
  }

  const { events: rawEvents, error } = await fetchTenantBrevoEmailEvents({
    fromYmd,
    toYmd,
    dbName,
    campaignId
  })
  if (error) {
    return { events: [], error }
  }

  let events = filterBrevoEventsForTenant(rawEvents, {
    dbName,
    marketingTenantId,
    campaignId,
    userEmails
  })

  events = filterBrevoEventsByDateRange(events, fromYmd, toYmd)
  return { events }
}
