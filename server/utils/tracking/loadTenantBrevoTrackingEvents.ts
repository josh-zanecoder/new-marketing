import { fetchCachedBrevoEventReport } from '@server/utils/tracking/brevoEventReportCache'
import {
  extractBrevoEventsFromReport,
  filterBrevoEventsByDateRange,
  filterBrevoEventsForTenant,
  type BrevoTrackingEmailEvent
} from '@server/utils/tracking/brevoTenantEvents'

export interface LoadTenantBrevoTrackingEventsOptions {
  campaignId?: string | null
  fromYmd?: string | null
  toYmd?: string | null
}

export async function loadTenantBrevoTrackingEvents(
  dbName: string,
  marketingTenantId: string | null,
  options: LoadTenantBrevoTrackingEventsOptions = {}
): Promise<{ events: BrevoTrackingEmailEvent[]; error?: string }> {
  const fromYmd = options.fromYmd ?? null
  const toYmd = options.toYmd ?? null

  const { report, error } = await fetchCachedBrevoEventReport(
    fromYmd && toYmd ? { startDate: fromYmd, endDate: toYmd } : {}
  )
  if (error) {
    return { events: [], error }
  }

  let events = filterBrevoEventsForTenant(
    extractBrevoEventsFromReport(report),
    dbName,
    marketingTenantId,
    options.campaignId ?? null
  )

  events = filterBrevoEventsByDateRange(events, fromYmd, toYmd)
  return { events }
}
