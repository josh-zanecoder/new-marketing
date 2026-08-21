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

function firstEventQueryToken(raw: unknown): string {
  if (typeof raw === 'string') return raw.split(/[,|]/)[0]?.trim() || ''
  if (Array.isArray(raw) && typeof raw[0] === 'string') {
    return raw[0].split(/[,|]/)[0]?.trim() || ''
  }
  return ''
}

/** Mongo Messages filter. Keep unique_opened distinct from opened (Brevo API collapses them). */
function resolveStatsEventsEventType(raw: unknown): string | null {
  const token = firstEventQueryToken(raw)
  const compact = token.toLowerCase().replace(/[_\s-]+/g, '')
  if (compact === 'uniqueopened' || compact === 'firstopening') return 'unique_opened'
  return normalizeBrevoEventTypesQuery(raw)[0] ?? null
}

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

/**
 * Campaign SMTP statistics from Mongo `brevo_tracking_events` only.
 * Brevo full sync is owned by POST /tracking/sync (Tracking Refresh).
 */
export default defineEventHandler(async (event) => {
  const { dbName } = await resolveTrackingTenantContext(event)

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

  const tzOffsetMinutes = normalizeTzOffsetQuery(event)
  const clampedToToday = clampBrevoSmtpDateRange(fromYmd, toYmd, new Date(), tzOffsetMinutes)
  const range = clampBrevoSmtpStatsRangeToMaxDays(
    clampedToToday.startDate,
    clampedToToday.endDate
  )

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
  const eventType = resolveStatsEventsEventType(q.event ?? q.events)
  // skipCache used to re-pull Brevo here (doubled Refresh cost with /tracking/sync).
  // Stats always reads Mongo; Tracking Refresh owns the Brevo full sync.

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
