import type { FilterQuery, PipelineStage } from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { getTenantConnectionByDbName } from '@server/tenant/connection'
import { parseYmdToUtcBounds } from '@server/utils/tracking/brevoTrackingEventDateBounds'
import type {
  BrevoSmtpAggregated,
  BrevoSmtpDailyRow
} from '@server/utils/tracking/fetchBrevoTransactionalStats'
import { mongoExcludeCampaignTestEmailTag } from '@server/utils/zcmail/campaignZcMailTags'

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

/** Map stored Brevo / SES / zcMail event labels onto SMTP aggregated counters. */
export function metricKeyForEvent(raw: string): keyof BrevoSmtpDailyRow | null {
  const t = raw.trim().toLowerCase().replace(/[_\s-]+/g, '')
  if (!t) return null
  if (t === 'requests' || t === 'sent' || t === 'request' || t === 'send') return 'requests'
  if (t === 'delivered' || t === 'delivery') return 'delivered'
  if (t === 'uniqueopened' || t === 'firstopening') return 'uniqueOpens'
  if (t === 'opened' || t === 'open' || t === 'opens') return 'opens'
  if (t === 'clicks' || t === 'click' || t === 'clicked') return 'clicks'
  if (
    t === 'hardbounces' ||
    t === 'hardbounce' ||
    t === 'bounce' ||
    t === 'bounces' ||
    t === 'failed'
  ) {
    return 'hardBounces'
  }
  if (t === 'softbounces' || t === 'softbounce') return 'softBounces'
  if (t === 'blocked' || t === 'reject') return 'blocked'
  if (t === 'invalid') return 'invalid'
  if (t === 'spam' || t === 'complaint') return 'spamReports'
  if (t === 'unsubscribed' || t === 'unsubscribe') return 'unsubscribed'
  return null
}

export type GroupedSmtpStatRow = {
  _id: { day?: string; event?: string }
  count: number
  uniqueMessageIds?: string[]
  uniqueKeys?: string[]
}

const SEND_LIKE_METRICS: Array<keyof BrevoSmtpDailyRow> = [
  'requests',
  'delivered',
  'hardBounces',
  'softBounces',
  'blocked'
]

/** Distinct messageId, else messageId|email, so blank SES ids still count. */
export function uniqueFunnelIds(row: GroupedSmtpStatRow): string[] {
  const messageIds = (row.uniqueMessageIds ?? [])
    .map((id) => String(id || '').trim())
    .filter(Boolean)
  if (messageIds.length) return messageIds
  return (row.uniqueKeys ?? []).filter((k) => {
    const key = String(k || '').trim()
    return Boolean(key) && key !== '|'
  })
}

/** Funnel / once-per-message metrics — count distinct messageId, not raw rows. */
const UNIQUE_MESSAGE_METRICS = new Set<keyof BrevoSmtpDailyRow>([
  'requests',
  'delivered',
  'hardBounces',
  'softBounces',
  'blocked',
  'invalid',
  'spamReports',
  'unsubscribed',
  'uniqueOpens'
])

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

function addToKeyedSet(
  map: Map<keyof BrevoSmtpDailyRow, Set<string>>,
  key: keyof BrevoSmtpDailyRow,
  ids: string[]
): void {
  let set = map.get(key)
  if (!set) {
    set = new Set()
    map.set(key, set)
  }
  for (const id of ids) set.add(id)
}

/**
 * Roll Mongo `$group` rows into SMTP aggregated + daily series.
 * Exported so campaign Statistics can be unit-tested without a live tenant DB.
 */
export function rollupStoredSmtpStatsFromGroups(params: {
  startDate: string
  endDate: string
  rows: GroupedSmtpStatRow[]
}): { aggregated: BrevoSmtpAggregated; daily: BrevoSmtpDailyRow[] } {
  const startDate = params.startDate.trim()
  const endDate = params.endDate.trim()

  const dayMap = new Map<string, BrevoSmtpDailyRow>()
  for (const ymd of enumerateYmdRange(startDate, endDate)) {
    dayMap.set(ymd, emptyDailyRow(ymd))
  }

  const totals = emptyAggregated()
  const openUniqueTotal = new Set<string>()
  const clickUniqueTotal = new Set<string>()
  const openUniqueByDay = new Map<string, Set<string>>()
  const clickUniqueByDay = new Map<string, Set<string>>()
  const funnelUniqueTotal = new Map<keyof BrevoSmtpDailyRow, Set<string>>()
  const funnelUniqueByDay = new Map<string, Map<keyof BrevoSmtpDailyRow, Set<string>>>()
  const allUniqueTotal = new Set<string>()
  const allUniqueByDay = new Map<string, Set<string>>()
  let sawUniqueOpenedEvent = false

  const ensureDaily = (day: string): BrevoSmtpDailyRow => {
    let daily = dayMap.get(day)
    if (!daily) {
      daily = emptyDailyRow(day)
      dayMap.set(day, daily)
    }
    return daily
  }

  for (const row of params.rows) {
    const event = (row._id?.event || '').trim()
    const key = metricKeyForEvent(event)
    const bucketDay = (row._id?.day || '').trim() || startDate
    const daily = ensureDaily(bucketDay)
    const ids = uniqueFunnelIds(row)

    for (const id of ids) {
      allUniqueTotal.add(id)
      let daySet = allUniqueByDay.get(bucketDay)
      if (!daySet) {
        daySet = new Set()
        allUniqueByDay.set(bucketDay, daySet)
      }
      daySet.add(id)
    }

    if (!key) continue

    if (UNIQUE_MESSAGE_METRICS.has(key)) {
      if (ids.length === 0) {
        addCount(daily, key, row.count || 0)
        addCount(totals, key, row.count || 0)
      } else {
        addToKeyedSet(funnelUniqueTotal, key, ids)
        let dayMapForFunnel = funnelUniqueByDay.get(bucketDay)
        if (!dayMapForFunnel) {
          dayMapForFunnel = new Map()
          funnelUniqueByDay.set(bucketDay, dayMapForFunnel)
        }
        addToKeyedSet(dayMapForFunnel, key, ids)
      }
    } else {
      addCount(daily, key, row.count || 0)
      addCount(totals, key, row.count || 0)
    }

    if (key === 'uniqueOpens') sawUniqueOpenedEvent = true

    const keys = row.uniqueKeys ?? []
    if (key === 'opens' || key === 'uniqueOpens') {
      let daySet = openUniqueByDay.get(bucketDay)
      if (!daySet) {
        daySet = new Set()
        openUniqueByDay.set(bucketDay, daySet)
      }
      for (const k of keys) {
        if (!k || k === '|') continue
        daySet.add(k)
        openUniqueTotal.add(k)
      }
    }
    if (key === 'clicks') {
      let daySet = clickUniqueByDay.get(bucketDay)
      if (!daySet) {
        daySet = new Set()
        clickUniqueByDay.set(bucketDay, daySet)
      }
      for (const k of keys) {
        if (!k || k === '|') continue
        daySet.add(k)
        clickUniqueTotal.add(k)
      }
    }
  }

  for (const [key, set] of funnelUniqueTotal) {
    if (key === 'date') continue
    ;(totals as BrevoSmtpAggregated)[key] = ((totals as BrevoSmtpAggregated)[key] as number) +
      set.size as never
  }
  for (const [day, keyMap] of funnelUniqueByDay) {
    const daily = dayMap.get(day)
    if (!daily) continue
    for (const [key, set] of keyMap) {
      if (key === 'date') continue
      ;(daily as BrevoSmtpDailyRow)[key] = ((daily as BrevoSmtpDailyRow)[key] as number) +
        set.size as never
    }
  }

  if (totals.requests === 0) {
    const sendLike = new Set<string>(allUniqueTotal)
    for (const metric of SEND_LIKE_METRICS) {
      const set = funnelUniqueTotal.get(metric)
      if (set) for (const id of set) sendLike.add(id)
    }
    if (sendLike.size > 0) {
      totals.requests = sendLike.size
      for (const [day, set] of allUniqueByDay) {
        const daily = ensureDaily(day)
        if (daily.requests === 0) daily.requests = set.size
      }
    } else {
      const fromFunnel =
        (totals.delivered || 0) +
        (totals.hardBounces || 0) +
        (totals.softBounces || 0) +
        (totals.blocked || 0)
      if (fromFunnel > 0) totals.requests = fromFunnel
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
  return { aggregated: withRates(totals), daily }
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
  if (campaignId) {
    filter.campaignId = campaignId
    Object.assign(filter, mongoExcludeCampaignTestEmailTag())
  }
  if (userEmail) filter.userEmail = userEmail

  // Same padded UTC window as the Messages table so headline metrics cannot
  // drop rows the list still shows (exact local-day grouping still uses tzOffset).
  const bounds = parseYmdToUtcBounds(startDate, endDate, tzOffsetMinutes)
  if (bounds) {
    filter.eventAt = { $gte: bounds.start, $lte: bounds.end }
  }

  const pipeline: PipelineStage[] = [
    { $match: filter },
    {
      $group: {
        _id: {
          day: {
            $let: {
              vars: {
                instant: {
                  $convert: {
                    input: { $ifNull: ['$eventAt', '$date'] },
                    to: 'date',
                    onError: null,
                    onNull: null
                  }
                }
              },
              in: {
                $cond: {
                  if: { $eq: ['$$instant', null] },
                  then: '',
                  else: {
                    $dateToString: {
                      format: '%Y-%m-%d',
                      date: {
                        $subtract: ['$$instant', tzOffsetMinutes * 60_000]
                      }
                    }
                  }
                }
              }
            }
          },
          event: '$event'
        },
        count: { $sum: 1 },
        uniqueMessageIds: {
          $addToSet: {
            $trim: { input: { $ifNull: ['$messageId', ''] } }
          }
        },
        uniqueKeys: {
          $addToSet: {
            $concat: [
              { $trim: { input: { $ifNull: ['$messageId', ''] } } },
              '|',
              { $toLower: { $trim: { input: { $ifNull: ['$email', ''] } } } }
            ]
          }
        }
      }
    }
  ]

  const rows = (await BrevoTrackingEvent.aggregate(pipeline).exec()) as GroupedSmtpStatRow[]
  const rolled = rollupStoredSmtpStatsFromGroups({ startDate, endDate, rows })

  return {
    range,
    tag,
    aggregated: rolled.aggregated,
    daily: rolled.daily
  }
}
