import {
  getAggregatedSmtpReport,
  getSmtpDailyReport,
  getTransactionalEmailEventReport
} from '@server/services/brevo.service'
import type { BrevoEmailEventType } from '@server/utils/tracking/brevoEventType'
import {
  buildBrevoEventReportTagToken,
  joinBrevoEventReportTags
} from './brevoEventReportQuery'

/** Match ratesheet: Brevo daily reports page size; values above ~10 can return out_of_range. */
export const BREVO_SMTP_REPORTS_PAGE_LIMIT = 10
/**
 * Match ratesheet: keep event list pages small — Brevo events `limit` above ~10 often
 * returns out_of_range on some accounts.
 */
export const BREVO_SMTP_EVENTS_PAGE_LIMIT_MAX = 10
/** Daily SMTP report windows stay within Brevo’s practical range. */
const BREVO_SMTP_DAILY_MAX_RANGE_DAYS = 30

export type BrevoSmtpAggregatedRates = {
  deliveredPct: number
  uniqueOpensPct: number
  opensPct: number
  uniqueClicksPct: number
  hardBouncesPct: number
  softBouncesPct: number
  blockedPct: number
  invalidPct: number
  spamReportsPct: number
  unsubscribedPct: number
}

export type BrevoSmtpAggregated = {
  range?: string
  requests: number
  delivered: number
  hardBounces: number
  softBounces: number
  opens: number
  uniqueOpens: number
  clicks: number
  uniqueClicks: number
  blocked: number
  invalid: number
  spamReports: number
  unsubscribed: number
  rates: BrevoSmtpAggregatedRates
}

export type BrevoSmtpDailyRow = {
  date: string
  requests: number
  delivered: number
  hardBounces: number
  softBounces: number
  opens: number
  uniqueOpens: number
  clicks: number
  uniqueClicks: number
  blocked: number
  invalid: number
  spamReports: number
  unsubscribed: number
}

export type BrevoSmtpStatsEventItem = {
  email: string
  date: string
  subject: string
  messageId: string
  event: string
  from: string
  reason: string
}

export type BrevoTransactionalStatsResult = {
  range: { startDate: string; endDate: string }
  tag: string | null
  aggregated: BrevoSmtpAggregated
  daily: BrevoSmtpDailyRow[]
  events: {
    items: BrevoSmtpStatsEventItem[]
    limit: number
    offset: number
    hasMore: boolean
  }
}

function pct(num: number, den: number): number {
  if (den <= 0) return 0
  return Math.round((num / den) * 10000) / 100
}

function n(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

/** Brevo rejects endDate after their UTC calendar "today". */
export function clampBrevoSmtpDateRange(
  startDate: string,
  endDate: string,
  now: Date = new Date()
): { startDate: string; endDate: string } {
  const todayUtc = now.toISOString().slice(0, 10)
  const end = endDate > todayUtc ? todayUtc : endDate
  const start = startDate > end ? end : startDate
  return { startDate: start, endDate: end }
}

function parseYmdUtc(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) return null
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
}

function toYmdUtc(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addUtcDays(ymd: string, days: number): string {
  const d = parseYmdUtc(ymd)
  if (!d) return ymd
  d.setUTCDate(d.getUTCDate() + days)
  return toYmdUtc(d)
}

function enumerateDailyWindows(
  startDate: string,
  endDate: string
): Array<{ startDate: string; endDate: string }> {
  const windows: Array<{ startDate: string; endDate: string }> = []
  let cursor = startDate
  while (cursor <= endDate) {
    const windowEnd = addUtcDays(cursor, BREVO_SMTP_DAILY_MAX_RANGE_DAYS - 1)
    const end = windowEnd < endDate ? windowEnd : endDate
    windows.push({ startDate: cursor, endDate: end })
    cursor = addUtcDays(end, 1)
  }
  return windows
}

function mapAggregated(raw: Record<string, unknown>): BrevoSmtpAggregated {
  const requests = n(raw.requests)
  const delivered = n(raw.delivered)
  return {
    range: typeof raw.range === 'string' ? raw.range : undefined,
    requests,
    delivered,
    hardBounces: n(raw.hardBounces),
    softBounces: n(raw.softBounces),
    opens: n(raw.opens),
    uniqueOpens: n(raw.uniqueOpens),
    clicks: n(raw.clicks),
    uniqueClicks: n(raw.uniqueClicks),
    blocked: n(raw.blocked),
    invalid: n(raw.invalid),
    spamReports: n(raw.spamReports),
    unsubscribed: n(raw.unsubscribed),
    rates: {
      deliveredPct: pct(delivered, requests),
      uniqueOpensPct: pct(n(raw.uniqueOpens), requests),
      opensPct: pct(n(raw.opens), requests),
      uniqueClicksPct: pct(n(raw.uniqueClicks), requests),
      hardBouncesPct: pct(n(raw.hardBounces), requests),
      softBouncesPct: pct(n(raw.softBounces), requests),
      blockedPct: pct(n(raw.blocked), requests),
      invalidPct: pct(n(raw.invalid), requests),
      spamReportsPct: pct(n(raw.spamReports), requests),
      unsubscribedPct: pct(n(raw.unsubscribed), requests)
    }
  }
}

function mapDailyRow(raw: Record<string, unknown>): BrevoSmtpDailyRow | null {
  const date = typeof raw.date === 'string' ? raw.date.trim() : ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  return {
    date,
    requests: n(raw.requests),
    delivered: n(raw.delivered),
    hardBounces: n(raw.hardBounces),
    softBounces: n(raw.softBounces),
    opens: n(raw.opens),
    uniqueOpens: n(raw.uniqueOpens),
    clicks: n(raw.clicks),
    uniqueClicks: n(raw.uniqueClicks),
    blocked: n(raw.blocked),
    invalid: n(raw.invalid),
    spamReports: n(raw.spamReports),
    unsubscribed: n(raw.unsubscribed)
  }
}

async function fetchSmtpDailyReportRows(params: {
  startDate: string
  endDate: string
  tag?: string
  dbName: string
}): Promise<{ rows: BrevoSmtpDailyRow[]; error?: string }> {
  const merged = new Map<string, BrevoSmtpDailyRow>()
  const windows = enumerateDailyWindows(params.startDate, params.endDate)

  for (const window of windows) {
    let offset = 0
    for (;;) {
      const { report, error } = await getSmtpDailyReport(
        {
          limit: BREVO_SMTP_REPORTS_PAGE_LIMIT,
          offset,
          startDate: window.startDate,
          endDate: window.endDate,
          ...(params.tag ? { tag: params.tag } : {}),
          sort: 'asc'
        },
        { dbName: params.dbName }
      )
      if (error) return { rows: [], error }

      const batchRaw =
        report && typeof report === 'object' && Array.isArray((report as { reports?: unknown }).reports)
          ? ((report as { reports: unknown[] }).reports as Record<string, unknown>[])
          : []

      for (const item of batchRaw) {
        const row = mapDailyRow(item)
        if (row) merged.set(row.date, row)
      }

      if (batchRaw.length < BREVO_SMTP_REPORTS_PAGE_LIMIT) break
      offset += BREVO_SMTP_REPORTS_PAGE_LIMIT
      if (offset > 4000) break
    }
  }

  return {
    rows: [...merged.values()].sort((a, b) => a.date.localeCompare(b.date))
  }
}

function mapStatsEventItem(raw: Record<string, unknown>): BrevoSmtpStatsEventItem {
  return {
    email: typeof raw.email === 'string' ? raw.email : '',
    date: typeof raw.date === 'string' ? raw.date : '',
    subject: typeof raw.subject === 'string' ? raw.subject : '',
    messageId: typeof raw.messageId === 'string' ? raw.messageId : '',
    event: raw.event != null ? String(raw.event) : '',
    from: typeof raw.from === 'string' ? raw.from : '',
    reason: typeof raw.reason === 'string' ? raw.reason : ''
  }
}

/**
 * Ratesheet-style Brevo stats: aggregated SMTP report + daily series + paginated events.
 * Pass `campaignId` and/or `userEmail` to scope Brevo tags (`campaign:…`, `user:…`).
 * Without those, scopes to `db:{dbName}` for tenant-wide analytics.
 */
export async function fetchBrevoTransactionalStats(params: {
  dbName: string
  campaignId?: string | null
  userEmail?: string | null
  /** Brevo events API single-type filter (omit = all types). */
  eventType?: BrevoEmailEventType | null
  startDate: string
  endDate: string
  eventsLimit?: number
  eventsOffset?: number
}): Promise<{ stats?: BrevoTransactionalStatsResult; error?: string }> {
  const range = clampBrevoSmtpDateRange(params.startDate, params.endDate)
  const campaignId = params.campaignId?.trim() || null
  const userEmail = params.userEmail?.trim().toLowerCase() || null
  const userTag = userEmail?.includes('@') ? `user:${userEmail}` : null

  // Aggregated + daily accept a single tag. Prefer campaign, then user, then db.
  const tag =
    buildBrevoEventReportTagToken({
      campaignId,
      dbName: campaignId || userTag ? null : params.dbName
    }) ??
    userTag ??
    undefined

  // Events can take multiple tags (AND). Include campaign/user when set; else db.
  const eventTagTokens: string[] = []
  if (campaignId) eventTagTokens.push(`campaign:${campaignId}`)
  if (userTag) eventTagTokens.push(userTag)
  if (!eventTagTokens.length) {
    const dbTag = buildBrevoEventReportTagToken({ dbName: params.dbName })
    if (dbTag) eventTagTokens.push(dbTag)
  }
  const tagsFilter = joinBrevoEventReportTags(eventTagTokens)

  const eventsLimit = Math.min(
    BREVO_SMTP_EVENTS_PAGE_LIMIT_MAX,
    Math.max(1, params.eventsLimit ?? BREVO_SMTP_EVENTS_PAGE_LIMIT_MAX)
  )
  const eventsOffset = Math.max(0, params.eventsOffset ?? 0)

  const [aggResult, dailyResult, eventsResult] = await Promise.all([
    getAggregatedSmtpReport(
      {
        startDate: range.startDate,
        endDate: range.endDate,
        ...(tag ? { tag } : {})
      },
      { dbName: params.dbName }
    ),
    fetchSmtpDailyReportRows({
      startDate: range.startDate,
      endDate: range.endDate,
      tag,
      dbName: params.dbName
    }),
    getTransactionalEmailEventReport(
      {
        limit: eventsLimit,
        offset: eventsOffset,
        startDate: range.startDate,
        endDate: range.endDate,
        ...(tagsFilter ? { tags: tagsFilter } : {}),
        ...(params.eventType ? { event: params.eventType } : {}),
        sort: 'desc'
      },
      { dbName: params.dbName }
    )
  ])

  if (aggResult.error) return { error: aggResult.error }
  if (dailyResult.error) return { error: dailyResult.error }
  if (eventsResult.error) return { error: eventsResult.error }

  const aggRaw =
    aggResult.report && typeof aggResult.report === 'object'
      ? (aggResult.report as Record<string, unknown>)
      : {}

  const rawEvents =
    eventsResult.report &&
    typeof eventsResult.report === 'object' &&
    Array.isArray((eventsResult.report as { events?: unknown }).events)
      ? ((eventsResult.report as { events: Record<string, unknown>[] }).events)
      : []

  const items = rawEvents.map(mapStatsEventItem)

  return {
    stats: {
      range,
      tag: tag ?? null,
      aggregated: mapAggregated(aggRaw),
      daily: dailyResult.rows,
      events: {
        items,
        limit: eventsLimit,
        offset: eventsOffset,
        hasMore: items.length === eventsLimit
      }
    }
  }
}
