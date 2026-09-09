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
import { parseYmdToExactUtcBounds } from '@server/utils/tracking/brevoTrackingEventDateBounds'
import {
  mergeTrackingUserEmails,
  resolveTrackingTenantContext
} from '@server/utils/tracking/resolveTrackingTenantContext'
import { getTenantConnectionByDbName } from '@server/tenant/connection'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { FilterQuery } from 'mongoose'

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

function normalizeTagUsers(emails: string[]): string[] {
  return [
    ...new Set(
      emails.map((e) => e.trim().toLowerCase()).filter((e) => e.includes('@'))
    )
  ].sort((a, b) => a.localeCompare(b))
}

/** Distinct operator emails on tracking events (same source as Tracking User filter). */
async function loadAnalyticsTagUsers(params: {
  dbName: string
  campaignId: string | null
  fromYmd: string
  toYmd: string
  tzOffsetMinutes: number | null
  ownershipEmails: string[] | null
}): Promise<string[]> {
  if (params.ownershipEmails != null) {
    return normalizeTagUsers(params.ownershipEmails)
  }

  const conn = await getTenantConnectionByDbName(params.dbName)
  const { BrevoTrackingEvent, Campaign } = getTenantClientModels(conn)
  const scopeFilter: FilterQuery<Record<string, unknown>> = {}
  if (params.campaignId) scopeFilter.campaignId = params.campaignId
  const bounds = parseYmdToExactUtcBounds(
    params.fromYmd,
    params.toYmd,
    params.tzOffsetMinutes
  )
  if (bounds) {
    scopeFilter.eventAt = { $gte: bounds.start, $lte: bounds.end }
  }

  const distinctUsers = (await BrevoTrackingEvent.distinct(
    'userEmail',
    scopeFilter
  )) as string[]
  const fromEvents = normalizeTagUsers(distinctUsers)
  if (fromEvents.length) return fromEvents

  // zcMail archive sync often stored blank userEmail when tags were missing.
  // Fall back to campaign mergeUserSnapshot emails for campaigns in range.
  const campaignIds = params.campaignId
    ? [params.campaignId]
    : ((await BrevoTrackingEvent.distinct('campaignId', scopeFilter)) as string[]).filter(
        (id) => String(id || '').trim()
      )
  if (!campaignIds.length) return []

  const campaigns = (await Campaign.find({ _id: { $in: campaignIds } })
    .select({ mergeUserSnapshot: 1 })
    .lean()
    .exec()) as Array<{ mergeUserSnapshot?: { email?: string } }>
  return normalizeTagUsers(
    campaigns.map((c) => String(c.mergeUserSnapshot?.email || ''))
  )
}

/**
 * Marketing Analytics from Mongo `brevo_tracking_events` only (no Brevo HTTP).
 * Sync fresh events via Tracking Refresh / webhooks.
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

  const [reports, mongoEvents, tagUsers] = await Promise.all([
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
    }),
    loadAnalyticsTagUsers({
      dbName,
      campaignId,
      fromYmd,
      toYmd,
      tzOffsetMinutes,
      ownershipEmails
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
      tagUsers,
      allowUserTagFilter
    }
  }
})
