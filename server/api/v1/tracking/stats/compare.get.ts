import mongoose from 'mongoose'
import {
  normalizeCampaignIdQuery,
  normalizeTzOffsetQuery,
  normalizeYmdQuery
} from '@server/utils/tracking/brevoTenantEvents'
import { aggregateStoredBrevoSmtpStats } from '@server/utils/tracking/aggregateStoredBrevoSmtpStats'
import {
  clampBrevoSmtpDateRange,
  clampBrevoSmtpStatsRangeToMaxDays,
  type BrevoSmtpAggregated
} from '@server/utils/tracking/fetchBrevoTransactionalStats'
import { resolveTrackingTenantContext } from '@server/utils/tracking/resolveTrackingTenantContext'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { getTenantConnectionByDbName } from '@server/tenant/connection'
import { CAMPAIGN_RECIPIENT_STATUS_SENT } from '@server/utils/campaignSend/constants'

const MAX_COMPARE = 5

function parseCampaignIds(event: Parameters<typeof getQuery>[0]): string[] {
  const q = getQuery(event) as Record<string, unknown>
  const raw = q.campaignIds ?? q.campaignId
  const parts: string[] = []
  if (typeof raw === 'string') {
    parts.push(...raw.split(/[,|]/).map((s) => s.trim()))
  } else if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === 'string') parts.push(...item.split(/[,|]/).map((s) => s.trim()))
    }
  }
  const single = normalizeCampaignIdQuery(event)
  if (single) parts.push(single)

  const seen = new Set<string>()
  const out: string[] = []
  for (const id of parts) {
    if (!/^[a-f\d]{24}$/i.test(id) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
    if (out.length >= MAX_COMPARE) break
  }
  return out
}

function pct(num: number, den: number): number {
  if (den <= 0) return 0
  return Math.round((num / den) * 10000) / 100
}

/** Recompute rate percentages after overriding `requests` (Sent). */
function withRequestsCount(aggregated: BrevoSmtpAggregated, requests: number): BrevoSmtpAggregated {
  const next = { ...aggregated, requests, rates: { ...aggregated.rates } }
  next.rates = {
    deliveredPct: pct(next.delivered, requests),
    uniqueOpensPct: pct(next.uniqueOpens, requests),
    opensPct: pct(next.opens, requests),
    uniqueClicksPct: pct(next.uniqueClicks, requests),
    hardBouncesPct: pct(next.hardBounces, requests),
    softBouncesPct: pct(next.softBounces, requests),
    blockedPct: pct(next.blocked, requests),
    invalidPct: pct(next.invalid, requests),
    spamReportsPct: pct(next.spamReports, requests),
    unsubscribedPct: pct(next.unsubscribed, requests)
  }
  return next
}

/**
 * Side-by-side SMTP aggregates for up to 5 campaigns (client vs prospect, etc.).
 * Sent uses CampaignRecipient `sent` counts (same source as campaign details).
 */
export default defineEventHandler(async (event) => {
  const { dbName } = await resolveTrackingTenantContext(event)
  const campaignIds = parseCampaignIds(event)
  if (campaignIds.length < 2) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Provide at least two campaignIds'
    })
  }

  const q = getQuery(event) as Record<string, unknown>
  const lifetime =
    q.lifetime === '1' ||
    q.lifetime === 1 ||
    String(q.lifetime || '').toLowerCase() === 'true' ||
    String(q.lifetime || '').toLowerCase() === 'all'

  const tzOffsetMinutes = normalizeTzOffsetQuery(event)
  let startDate = ''
  let endDate = ''
  const skipDateFilter = lifetime

  if (!lifetime) {
    const fromYmd = normalizeYmdQuery(event, 'from')
    const toYmd = normalizeYmdQuery(event, 'to')
    if (!fromYmd || !toYmd) {
      throw createError({
        statusCode: 400,
        statusMessage: 'from and to (YYYY-MM-DD) are required (or pass lifetime=1)'
      })
    }
    const clampedToToday = clampBrevoSmtpDateRange(fromYmd, toYmd, new Date(), tzOffsetMinutes)
    const range = clampBrevoSmtpStatsRangeToMaxDays(
      clampedToToday.startDate,
      clampedToToday.endDate
    )
    startDate = range.startDate
    endDate = range.endDate
  } else {
    const today = new Date()
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    endDate = `${y}-${m}-${d}`
    startDate = endDate
  }

  const conn = await getTenantConnectionByDbName(dbName)
  const { Campaign, CampaignRecipient } = getTenantClientModels(conn)
  const campaignDocs = (await Campaign.find({ _id: { $in: campaignIds } })
    .select({ name: 1 })
    .lean()
    .exec()) as Array<{ _id: { toString(): string }; name?: string }>
  const nameById = new Map(
    campaignDocs.map((c) => [String(c._id), String(c.name || '').trim() || String(c._id)])
  )

  const campaigns = await Promise.all(
    campaignIds.map(async (campaignId) => {
      const objectId = new mongoose.Types.ObjectId(campaignId)
      const [stats, sentCount] = await Promise.all([
        aggregateStoredBrevoSmtpStats({
          dbName,
          campaignId,
          startDate,
          endDate,
          tzOffsetMinutes,
          skipDateFilter
        }),
        CampaignRecipient.countDocuments({
          campaign: objectId,
          status: CAMPAIGN_RECIPIENT_STATUS_SENT
        })
      ])

      // Campaign details Sent = recipients with status "sent" — keep compare aligned.
      const aggregated = withRequestsCount(stats.aggregated, sentCount)

      return {
        campaignId,
        name: nameById.get(campaignId) || campaignId,
        aggregated,
        daily: stats.daily,
        sentRecipients: sentCount
      }
    })
  )

  return {
    ok: true as const,
    lifetime: skipDateFilter,
    range: skipDateFilter
      ? { startDate: null, endDate: null }
      : { startDate, endDate },
    campaigns
  }
})
