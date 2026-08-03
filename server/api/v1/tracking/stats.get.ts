import { normalizeBrevoEventTypesQuery } from '@server/utils/tracking/brevoEventType'
import {
  normalizeCampaignIdQuery,
  normalizeTzOffsetQuery,
  normalizeYmdQuery
} from '@server/utils/tracking/brevoTenantEvents'
import { aggregateStoredBrevoSmtpStats } from '@server/utils/tracking/aggregateStoredBrevoSmtpStats'
import {
  BREVO_SMTP_EVENTS_PAGE_LIMIT_MAX,
  clampBrevoSmtpDateRange,
  clampBrevoSmtpStatsRangeToMaxDays
} from '@server/utils/tracking/fetchBrevoTransactionalStats'
import { loadStoredCampaignSmtpStatsEventsPage } from '@server/utils/tracking/loadStoredCampaignSmtpStatsEventsPage'
import { resolveTrackingTenantContext } from '@server/utils/tracking/resolveTrackingTenantContext'
import { syncTenantBrevoTrackingEvents } from '@server/utils/tracking/syncTenantBrevoTrackingEvents'
import { throwBrevoTrackingFetchError } from '@server/utils/tracking/throwBrevoTrackingFetchError'

function normalizeNonNegIntQuery(
  event: Parameters<typeof getQuery>[0],
  key: string,
  fallback: number
): number {
  const q = getQuery(event) as Record<string, unknown>
  const raw = q[key]
  const s =
    typeof raw === 'string'
      ? raw.trim()
      : Array.isArray(raw) && typeof raw[0] === 'string'
        ? raw[0].trim()
        : typeof raw === 'number'
          ? String(raw)
          : ''
  const n = Number.parseInt(s, 10)
  if (!Number.isFinite(n) || n < 0) return fallback
  return n
}

function normalizeSkipCacheQuery(event: Parameters<typeof getQuery>[0]): boolean {
  const q = getQuery(event) as Record<string, unknown>
  const raw = q.skipCache ?? q.refresh
  const s =
    typeof raw === 'string'
      ? raw.trim().toLowerCase()
      : Array.isArray(raw) && typeof raw[0] === 'string'
        ? raw[0].trim().toLowerCase()
        : raw === true
          ? 'true'
          : ''
  return s === '1' || s === 'true' || s === 'yes'
}

/**
 * Campaign SMTP statistics from Mongo `brevo_tracking_events`.
 * Refresh syncs unaggregated Brevo events, then re-aggregates locally.
 */
export default defineEventHandler(async (event) => {
  const { dbName, marketingTenantId } = await resolveTrackingTenantContext(event)

  const campaignId = normalizeCampaignIdQuery(event)
  if (!campaignId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'campaignId is required'
    })
  }

  const fromYmd = normalizeYmdQuery(event, 'from')
  const toYmd = normalizeYmdQuery(event, 'to')
  if (!fromYmd || !toYmd) {
    throw createError({
      statusCode: 400,
      statusMessage: 'from and to (YYYY-MM-DD) are required'
    })
  }

  const clampedToToday = clampBrevoSmtpDateRange(fromYmd, toYmd)
  const range = clampBrevoSmtpStatsRangeToMaxDays(
    clampedToToday.startDate,
    clampedToToday.endDate
  )
  const tzOffsetMinutes = normalizeTzOffsetQuery(event)

  const eventsLimit = Math.min(
    BREVO_SMTP_EVENTS_PAGE_LIMIT_MAX,
    Math.max(
      1,
      normalizeNonNegIntQuery(event, 'eventsLimit', BREVO_SMTP_EVENTS_PAGE_LIMIT_MAX) ||
        BREVO_SMTP_EVENTS_PAGE_LIMIT_MAX
    )
  )
  const eventsOffset = normalizeNonNegIntQuery(event, 'eventsOffset', 0)
  const q = getQuery(event) as Record<string, unknown>
  const eventType = normalizeBrevoEventTypesQuery(q.event ?? q.events)[0] ?? null
  const skipCache = normalizeSkipCacheQuery(event)

  if (skipCache) {
    const sync = await syncTenantBrevoTrackingEvents({
      dbName,
      marketingTenantId,
      fromYmd: range.startDate,
      toYmd: range.endDate,
      campaignId
    })
    if (sync.error) {
      throwBrevoTrackingFetchError(sync.error)
    }
  }

  const [reports, mongoEvents] = await Promise.all([
    aggregateStoredBrevoSmtpStats({
      dbName,
      campaignId,
      startDate: range.startDate,
      endDate: range.endDate,
      tzOffsetMinutes
    }),
    loadStoredCampaignSmtpStatsEventsPage({
      dbName,
      campaignId,
      startDate: range.startDate,
      endDate: range.endDate,
      eventType,
      limit: eventsLimit,
      offset: eventsOffset
    })
  ])

  return {
    stats: {
      range: reports.range,
      tag: reports.tag,
      aggregated: reports.aggregated,
      daily: reports.daily,
      events: {
        items: mongoEvents.items,
        limit: eventsLimit,
        offset: eventsOffset,
        hasMore: mongoEvents.hasMore
      }
    }
  }
})
