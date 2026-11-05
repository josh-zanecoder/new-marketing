import {
  normalizeCampaignIdQuery,
  normalizeTzOffsetQuery,
  normalizeYmdQuery
} from '@server/utils/tracking/brevoTenantEvents'
import { aggregateStoredBrevoSmtpStats } from '@server/utils/tracking/aggregateStoredBrevoSmtpStats'
import {
  clampBrevoSmtpDateRange,
  clampBrevoSmtpStatsRangeToMaxDays
} from '@server/utils/tracking/fetchBrevoTransactionalStats'
import { resolveTrackingTenantContext } from '@server/utils/tracking/resolveTrackingTenantContext'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { getTenantConnectionByDbName } from '@server/tenant/connection'

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

/**
 * Side-by-side SMTP aggregates for up to 5 campaigns (client vs prospect, etc.).
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

  const conn = await getTenantConnectionByDbName(dbName)
  const { Campaign } = getTenantClientModels(conn)
  const campaignDocs = (await Campaign.find({ _id: { $in: campaignIds } })
    .select({ name: 1 })
    .lean()
    .exec()) as Array<{ _id: { toString(): string }; name?: string }>
  const nameById = new Map(
    campaignDocs.map((c) => [String(c._id), String(c.name || '').trim() || String(c._id)])
  )

  const campaigns = await Promise.all(
    campaignIds.map(async (campaignId) => {
      const stats = await aggregateStoredBrevoSmtpStats({
        dbName,
        campaignId,
        startDate: range.startDate,
        endDate: range.endDate,
        tzOffsetMinutes
      })
      return {
        campaignId,
        name: nameById.get(campaignId) || campaignId,
        aggregated: stats.aggregated,
        daily: stats.daily
      }
    })
  )

  return {
    ok: true as const,
    range: { startDate: range.startDate, endDate: range.endDate },
    campaigns
  }
})
