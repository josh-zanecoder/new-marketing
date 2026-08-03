import {
  normalizeCampaignIdQuery,
  normalizeTzOffsetQuery,
  normalizeUserEmailQuery,
  normalizeYmdQuery
} from '@server/utils/tracking/brevoTenantEvents'
import { normalizeBrevoEventTypesQuery } from '@server/utils/tracking/brevoEventType'
import { aggregateStoredBrevoSmtpStats } from '@server/utils/tracking/aggregateStoredBrevoSmtpStats'
import { BREVO_SMTP_EVENTS_PAGE_LIMIT_MAX } from '@server/utils/tracking/fetchBrevoTransactionalStats'
import { loadStoredCampaignSmtpStatsEventsPage } from '@server/utils/tracking/loadStoredCampaignSmtpStatsEventsPage'
import { marketingAnalyticsFromSmtpStats } from '@server/utils/tracking/marketingAnalyticsFromSmtpStats'
import {
  mergeTrackingUserEmails,
  resolveTrackingTenantContext
} from '@server/utils/tracking/resolveTrackingTenantContext'
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
 * Marketing Analytics from Mongo `brevo_tracking_events` (totals + daily + paged messages).
 * Refresh (`skipCache`) syncs unaggregated Brevo events into Mongo first — never calls
 * Brevo tagged aggregated (that path is minutes-slow).
 */
export default defineEventHandler(async (event) => {
  const { dbName, marketingTenantId, userEmails, allowUserTagFilter } =
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

  const tzOffsetMinutes = normalizeTzOffsetQuery(event)
  const requestedUserEmail = normalizeUserEmailQuery(event)
  const { ownershipEmails, filterEmails } = mergeTrackingUserEmails(
    userEmails,
    requestedUserEmail,
    allowUserTagFilter
  )

  const scopedUserEmail =
    filterEmails?.[0] ??
    (ownershipEmails != null && ownershipEmails.length === 1 ? ownershipEmails[0] : null)

  const q = getQuery(event) as Record<string, unknown>
  const eventTypes = normalizeBrevoEventTypesQuery(q.event ?? q.events)
  const eventType = eventTypes[0] ?? null
  const skipCache = normalizeSkipCacheQuery(event)

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

  if (skipCache) {
    const sync = await syncTenantBrevoTrackingEvents({
      dbName,
      marketingTenantId,
      fromYmd,
      toYmd,
      campaignId
    })
    if (sync.error) {
      throwBrevoTrackingFetchError(sync.error)
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

  const [reports, mongoEvents] = await Promise.all([
    aggregateStoredBrevoSmtpStats({
      dbName,
      campaignId,
      userEmail: scopedUserEmail,
      startDate: fromYmd,
      endDate: toYmd,
      tzOffsetMinutes
    }),
    loadStoredCampaignSmtpStatsEventsPage({
      dbName,
      campaignId,
      userEmail: scopedUserEmail,
      startDate: fromYmd,
      endDate: toYmd,
      eventType,
      limit: eventsLimit,
      offset: eventsOffset
    })
  ])

  const { summary, timeseries } = marketingAnalyticsFromSmtpStats(
    reports.aggregated,
    reports.daily
  )

  const a = reports.aggregated
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
      events: {
        items: mongoEvents.items,
        limit: eventsLimit,
        offset: eventsOffset,
        hasMore: mongoEvents.hasMore
      },
      eventTypeCounts,
      tagUsers: ownershipEmails ?? [],
      allowUserTagFilter
    }
  }
})
