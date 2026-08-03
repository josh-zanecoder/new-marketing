import { normalizeBrevoEventTypesQuery } from '@server/utils/tracking/brevoEventType'
import {
  normalizeCampaignIdQuery,
  normalizeYmdQuery
} from '@server/utils/tracking/brevoTenantEvents'
import {
  BREVO_SMTP_EVENTS_PAGE_LIMIT_MAX,
  clampBrevoSmtpDateRange,
  clampBrevoSmtpStatsRangeToMaxDays,
  fetchBrevoTransactionalStats
} from '@server/utils/tracking/fetchBrevoTransactionalStats'
import { resolveTrackingTenantContext } from '@server/utils/tracking/resolveTrackingTenantContext'
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
 * Ratesheet-style Brevo SMTP statistics for a campaign (`tag=campaign:{id}`).
 * Live Brevo call with a 5-minute Mongo cache (pass skipCache/refresh to bypass).
 * Includes a small paginated events page (same pattern as ratesheet Statistics).
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

  const clampedToToday = clampBrevoSmtpDateRange(fromYmd, toYmd)
  const range = clampBrevoSmtpStatsRangeToMaxDays(
    clampedToToday.startDate,
    clampedToToday.endDate
  )

  const eventsLimit = Math.min(
    BREVO_SMTP_EVENTS_PAGE_LIMIT_MAX,
    Math.max(1, normalizeNonNegIntQuery(event, 'eventsLimit', BREVO_SMTP_EVENTS_PAGE_LIMIT_MAX) || BREVO_SMTP_EVENTS_PAGE_LIMIT_MAX)
  )
  const eventsOffset = normalizeNonNegIntQuery(event, 'eventsOffset', 0)
  const q = getQuery(event) as Record<string, unknown>
  const eventType = normalizeBrevoEventTypesQuery(q.event ?? q.events)[0] ?? null
  const skipCache = normalizeSkipCacheQuery(event)

  const { stats, error } = await fetchBrevoTransactionalStats({
    dbName,
    campaignId,
    startDate: range.startDate,
    endDate: range.endDate,
    eventType,
    eventsLimit,
    eventsOffset,
    skipCache
  })

  if (error) {
    throwBrevoTrackingFetchError(error)
  }

  return { stats }
})
