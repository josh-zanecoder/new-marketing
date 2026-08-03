import type { FilterQuery, PipelineStage } from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { getTenantConnectionByDbName } from '@server/tenant/connection'
import { parseYmdToExactUtcBounds } from '@server/utils/tracking/brevoTrackingEventDateBounds'
import type {
  BrevoSmtpAggregated,
  BrevoSmtpDailyRow
} from '@server/utils/tracking/fetchBrevoTransactionalStats'

function pct(num: number, den: number): number {
  if (den <= 0) return 0
  return Math.round((num / den) * 10000) / 100
}

function emptyAggregated(): BrevoSmtpAggregated {
  return {
    requests: 0,
    delivered: 0,
    hardBounces: 0,
    softBounces: 0,
    opens: 0,
    uniqueOpens: 0,
    clicks: 0,
    uniqueClicks: 0,
    blocked: 0,
    invalid: 0,
    spamReports: 0,
    unsubscribed: 0,
    rates: {
      deliveredPct: 0,
      uniqueOpensPct: 0,
      opensPct: 0,
      uniqueClicksPct: 0,
      hardBouncesPct: 0,
      softBouncesPct: 0,
      blockedPct: 0,
      invalidPct: 0,
      spamReportsPct: 0,
      unsubscribedPct: 0
    }
  }
}

function emptyDailyRow(date: string): BrevoSmtpDailyRow {
  return {
    date,
    requests: 0,
    delivered: 0,
    hardBounces: 0,
    softBounces: 0,
    opens: 0,
    uniqueOpens: 0,
    clicks: 0,
    uniqueClicks: 0,
    blocked: 0,
    invalid: 0,
    spamReports: 0,
    unsubscribed: 0
  }
}

function withRates(row: Omit<BrevoSmtpAggregated, 'rates'> & { range?: string }): BrevoSmtpAggregated {
  const requests = row.requests
  return {
    ...row,
    rates: {
      deliveredPct: pct(row.delivered, requests),
      uniqueOpensPct: pct(row.uniqueOpens, requests),
      opensPct: pct(row.opens, requests),
      uniqueClicksPct: pct(row.uniqueClicks, requests),
      hardBouncesPct: pct(row.hardBounces, requests),
      softBouncesPct: pct(row.softBounces, requests),
      blockedPct: pct(row.blocked, requests),
      invalidPct: pct(row.invalid, requests),
      spamReportsPct: pct(row.spamReports, requests),
      unsubscribedPct: pct(row.unsubscribed, requests)
    }
  }
}

/** Map stored Brevo event labels onto SMTP aggregated counters. */
function metricKeyForEvent(raw: string): keyof BrevoSmtpDailyRow | null {
  const t = raw.trim().toLowerCase()
  if (!t) return null
  if (t === 'requests' || t === 'sent' || t === 'request') return 'requests'
  if (t === 'delivered') return 'delivered'
  if (t === 'unique_opened' || t === 'uniqueopened') return 'uniqueOpens'
  if (t === 'opened' || t === 'open' || t === 'opens') return 'opens'
  if (t === 'clicks' || t === 'click' || t === 'clicked') return 'clicks'
  if (t === 'hardbounces' || t === 'hard_bounces' || t === 'hardbounce') return 'hardBounces'
  if (t === 'softbounces' || t === 'soft_bounces' || t === 'softbounce') return 'softBounces'
  if (t === 'blocked') return 'blocked'
  if (t === 'invalid') return 'invalid'
  if (t === 'spam' || t === 'complaint') return 'spamReports'
  if (t === 'unsubscribed' || t === 'unsubscribe') return 'unsubscribed'
  return null
}

function enumerateYmdRange(startYmd: string, endYmd: string): string[] {
  const out: string[] = []
  const [ys, ms, ds] = startYmd.split('-').map(Number)
  const [ye, me, de] = endYmd.split('-').map(Number)
  if (!ys || !ms || !ds || !ye || !me || !de) return out
  const cursor = new Date(Date.UTC(ys, ms - 1, ds))
  const end = new Date(Date.UTC(ye, me - 1, de))
  while (cursor.getTime() <= end.getTime()) {
    out.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return out
}

function addCount(
  row: BrevoSmtpDailyRow | BrevoSmtpAggregated,
  key: keyof BrevoSmtpDailyRow,
  n: number
): void {
  if (key === 'date') return
  const cur = (row as BrevoSmtpDailyRow)[key]
  if (typeof cur === 'number') {
    ;(row as BrevoSmtpDailyRow)[key] = (cur + n) as never
  }
}

/**
 * Build campaign/tenant SMTP aggregated + daily series from Mongo `brevo_tracking_events`.
 * Skips Brevo tagged aggregated APIs (those are minutes-slow).
 */
export async function aggregateStoredBrevoSmtpStats(params: {
  dbName: string
  campaignId?: string | null
  userEmail?: string | null
  startDate: string
  endDate: string
  /** Browser `Date#getTimezoneOffset()` for local day buckets. */
  tzOffsetMinutes?: number | null
}): Promise<{
  range: { startDate: string; endDate: string }
  tag: string | null
  aggregated: BrevoSmtpAggregated
  daily: BrevoSmtpDailyRow[]
}> {
  const campaignId = params.campaignId?.trim() || null
  const userEmail = params.userEmail?.trim().toLowerCase() || null
  const startDate = params.startDate.trim()
  const endDate = params.endDate.trim()
  const tzOffsetMinutes =
    typeof params.tzOffsetMinutes === 'number' && Number.isFinite(params.tzOffsetMinutes)
      ? params.tzOffsetMinutes
      : 0

  const range = { startDate, endDate }
  const tag = campaignId
    ? `campaign:${campaignId}`
    : userEmail
      ? `user:${userEmail}`
      : null

  const conn = await getTenantConnectionByDbName(params.dbName)
  const { BrevoTrackingEvent } = getTenantClientModels(conn)

  const filter: FilterQuery<Record<string, unknown>> = {}
  if (campaignId) filter.campaignId = campaignId
  if (userEmail) filter.userEmail = userEmail

  const bounds = parseYmdToExactUtcBounds(startDate, endDate, tzOffsetMinutes)
  if (bounds) {
    filter.eventAt = { $gte: bounds.start, $lte: bounds.end }
  }

  const pipeline: PipelineStage[] = [
    { $match: filter },
    {
      $group: {
        _id: {
          day: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: {
                $subtract: [
                  { $ifNull: ['$eventAt', { $toDate: '$date' }] },
                  tzOffsetMinutes * 60_000
                ]
              }
            }
          },
          event: '$event'
        },
        count: { $sum: 1 },
        uniqueKeys: {
          $addToSet: {
            $concat: [
              { $ifNull: ['$messageId', ''] },
              '|',
              { $toLower: { $ifNull: ['$email', ''] } }
            ]
          }
        }
      }
    }
  ]

  const rows = (await BrevoTrackingEvent.aggregate(pipeline).exec()) as Array<{
    _id: { day?: string; event?: string }
    count: number
    uniqueKeys?: string[]
  }>

  const dayMap = new Map<string, BrevoSmtpDailyRow>()
  for (const ymd of enumerateYmdRange(startDate, endDate)) {
    dayMap.set(ymd, emptyDailyRow(ymd))
  }

  const totals = emptyAggregated()
  const openUniqueTotal = new Set<string>()
  const clickUniqueTotal = new Set<string>()
  const openUniqueByDay = new Map<string, Set<string>>()
  const clickUniqueByDay = new Map<string, Set<string>>()
  let sawUniqueOpenedEvent = false

  for (const row of rows) {
    const day = (row._id?.day || '').trim()
    const event = (row._id?.event || '').trim()
    const key = metricKeyForEvent(event)
    if (!day || !key) continue

    let daily = dayMap.get(day)
    if (!daily) {
      daily = emptyDailyRow(day)
      dayMap.set(day, daily)
    }

    const count = row.count || 0
    addCount(daily, key, count)
    addCount(totals, key, count)

    if (key === 'uniqueOpens') sawUniqueOpenedEvent = true

    const keys = row.uniqueKeys ?? []
    if (key === 'opens' || key === 'uniqueOpens') {
      let daySet = openUniqueByDay.get(day)
      if (!daySet) {
        daySet = new Set()
        openUniqueByDay.set(day, daySet)
      }
      for (const k of keys) {
        if (!k || k === '|') continue
        daySet.add(k)
        openUniqueTotal.add(k)
      }
    }
    if (key === 'clicks') {
      let daySet = clickUniqueByDay.get(day)
      if (!daySet) {
        daySet = new Set()
        clickUniqueByDay.set(day, daySet)
      }
      for (const k of keys) {
        if (!k || k === '|') continue
        daySet.add(k)
        clickUniqueTotal.add(k)
      }
    }
  }

  if (!sawUniqueOpenedEvent && openUniqueTotal.size > 0) {
    totals.uniqueOpens = openUniqueTotal.size
    for (const [day, set] of openUniqueByDay) {
      const daily = dayMap.get(day)
      if (daily && daily.uniqueOpens === 0) daily.uniqueOpens = set.size
    }
  }
  if (totals.uniqueClicks === 0 && clickUniqueTotal.size > 0) {
    totals.uniqueClicks = clickUniqueTotal.size
    for (const [day, set] of clickUniqueByDay) {
      const daily = dayMap.get(day)
      if (daily && daily.uniqueClicks === 0) daily.uniqueClicks = set.size
    }
  }

  const daily = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date))

  return {
    range,
    tag,
    aggregated: withRates(totals),
    daily
  }
}
