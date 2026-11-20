import {
  normalizeCampaignIdQuery,
  normalizeTzOffsetQuery,
  normalizeYmdQuery
} from '@server/utils/tracking/brevoTenantEvents'
import { aggregateStoredBrevoSmtpStats } from '@server/utils/tracking/aggregateStoredBrevoSmtpStats'
import { countCampaignRecipientSent } from '@server/utils/tracking/countCampaignRecipientSent'
import {
  clampBrevoSmtpDateRange,
  clampBrevoSmtpStatsRangeToMaxDays
} from '@server/utils/tracking/fetchBrevoTransactionalStats'
import { resolveTrackingTenantContext } from '@server/utils/tracking/resolveTrackingTenantContext'
import { withBrevoSmtpRequestsCount } from '@server/utils/tracking/withBrevoSmtpRequestsCount'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { getTenantConnectionByDbName } from '@server/tenant/connection'
import type { CampaignRecipientModel } from '@server/types/tenant/campaignRecipient.model'
import { resolveCampaignCompareSentCount } from '~~/shared/utils/resolveCampaignCompareSentCount'

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
 * Sent prefers CampaignRecipient `sent` counts (same as campaign details), with SMTP
 * `requests` as fallback when the recipient ledger has no sent rows.
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

  const recipientModel = CampaignRecipient as CampaignRecipientModel

  const campaigns = await Promise.all(
    campaignIds.map(async (campaignId) => {
      const [stats, recipientSent] = await Promise.all([
        aggregateStoredBrevoSmtpStats({
          dbName,
          campaignId,
          startDate,
          endDate,
          tzOffsetMinutes,
          skipDateFilter
        }),
        countCampaignRecipientSent(recipientModel, campaignId)
      ])

      const sentCount = resolveCampaignCompareSentCount({
        recipientSent,
        smtpRequests: stats.aggregated.requests
      })
      const aggregated = withBrevoSmtpRequestsCount(stats.aggregated, sentCount)

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
