import {
  normalizeCampaignIdQuery,
  normalizeUserEmailQuery,
  normalizeYmdQuery
} from '@server/utils/tracking/brevoTenantEvents'
import { normalizeBrevoEventTypesQuery } from '@server/utils/tracking/brevoEventType'
import {
  BREVO_SMTP_EVENTS_PAGE_LIMIT_MAX,
  fetchBrevoTransactionalStats
} from '@server/utils/tracking/fetchBrevoTransactionalStats'
import { marketingAnalyticsFromSmtpStats } from '@server/utils/tracking/marketingAnalyticsFromSmtpStats'
import {
  mergeTrackingUserEmails,
  resolveTrackingTenantContext
} from '@server/utils/tracking/resolveTrackingTenantContext'
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
 * Ratesheet / campaign-Tracking style analytics:
 * Brevo aggregated SMTP + daily series + small paginated events page.
 * Does not load the full Tracking event dump.
 */
export default defineEventHandler(async (event) => {
  const { dbName, userEmails, allowUserTagFilter } =
    await resolveTrackingTenantContext(event)

  const campaignId = normalizeCampaignIdQuery(event)
  const fromYmd = normalizeYmdQuery(event, 'from')
  const toYmd = normalizeYmdQuery(event, 'to')
  if (!fromYmd || !toYmd) {
    throw createError({
      statusCode: 400,
      statusMessage: 'from and to (YYYY-MM-DD) are required'
    })
  }

  const requestedUserEmail = normalizeUserEmailQuery(event)
  const { ownershipEmails, filterEmails } = mergeTrackingUserEmails(
    userEmails,
    requestedUserEmail,
    allowUserTagFilter
  )

  // Single-owner sessions force that user tag; optional picker uses filterEmails.
  const scopedUserEmail =
    filterEmails?.[0] ??
    (ownershipEmails != null && ownershipEmails.length === 1 ? ownershipEmails[0] : null)

  const q = getQuery(event) as Record<string, unknown>
  const eventTypes = normalizeBrevoEventTypesQuery(q.event ?? q.events)
  // Brevo events API accepts a single `event` filter.
  const eventType = eventTypes[0] ?? null

  if (ownershipEmails != null && ownershipEmails.length === 0) {
    return {
      analytics: {
        summary: {
          emailsSent: 0,
          emailsDelivered: 0,
          uniqueOpens: 0,
          uniqueClicks: 0,
          bounces: 0,
          unsubscribes: 0,
          openRate: null,
          clickRate: null,
          bounceRate: null,
          unsubscribeRate: null
        },
        timeseries: [],
        events: { items: [], limit: 0, offset: 0, hasMore: false },
        eventTypeCounts: {},
        tagUsers: [],
        allowUserTagFilter
      }
    }
  }

  const eventsLimit = Math.min(
    BREVO_SMTP_EVENTS_PAGE_LIMIT_MAX,
    Math.max(
      1,
      normalizeNonNegIntQuery(event, 'eventsLimit', BREVO_SMTP_EVENTS_PAGE_LIMIT_MAX) ||
        BREVO_SMTP_EVENTS_PAGE_LIMIT_MAX
    )
  )
  const eventsOffset = normalizeNonNegIntQuery(event, 'eventsOffset', 0)

  const { stats, error } = await fetchBrevoTransactionalStats({
    dbName,
    campaignId,
    userEmail: scopedUserEmail,
    eventType,
    startDate: fromYmd,
    endDate: toYmd,
    eventsLimit,
    eventsOffset
  })

  if (error || !stats) {
    throwBrevoTrackingFetchError(error || 'Failed to load analytics')
  }

  const { summary, timeseries } = marketingAnalyticsFromSmtpStats(
    stats.aggregated,
    stats.daily
  )

  const a = stats.aggregated
  const eventTypeCounts: Record<string, number> = {
    requests: a.requests,
    delivered: a.delivered,
    opened: a.opens,
    clicks: a.clicks,
    hardBounces: a.hardBounces,
    softBounces: a.softBounces,
    blocked: a.blocked,
    invalid: a.invalid,
    spam: a.spamReports,
    unsubscribed: a.unsubscribed
  }

  return {
    analytics: {
      summary,
      timeseries,
      events: stats.events,
      eventTypeCounts,
      tagUsers: ownershipEmails ?? [],
      allowUserTagFilter
    }
  }
})
