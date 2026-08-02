import {
  normalizeCampaignIdQuery,
  normalizeYmdQuery
} from '@server/utils/tracking/brevoTenantEvents'
import {
  BREVO_SMTP_EVENTS_PAGE_LIMIT_MAX,
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

/**
 * Ratesheet-style Brevo SMTP statistics for a campaign (`tag=campaign:{id}`).
 * Live Brevo call — not the Mongo event store.
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

  const eventsLimit = Math.min(
    BREVO_SMTP_EVENTS_PAGE_LIMIT_MAX,
    Math.max(1, normalizeNonNegIntQuery(event, 'eventsLimit', BREVO_SMTP_EVENTS_PAGE_LIMIT_MAX) || BREVO_SMTP_EVENTS_PAGE_LIMIT_MAX)
  )
  const eventsOffset = normalizeNonNegIntQuery(event, 'eventsOffset', 0)

  const { stats, error } = await fetchBrevoTransactionalStats({
    dbName,
    campaignId,
    startDate: fromYmd,
    endDate: toYmd,
    eventsLimit,
    eventsOffset
  })

  if (error) {
    throwBrevoTrackingFetchError(error)
  }

  return { stats }
})
