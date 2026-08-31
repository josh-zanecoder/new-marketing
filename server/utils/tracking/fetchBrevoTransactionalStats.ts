/**
 * Shared SMTP stats shapes + date helpers used by Mongo rollups and the UI.
 * Live Brevo tagged aggregated fetching was removed — totals come from
 * `aggregateStoredBrevoSmtpStats` over `brevo_tracking_events`.
 */

/** Messages page size (Analytics / Statistics tables). */
export const BREVO_SMTP_EVENTS_PAGE_LIMIT_MAX = 10

/** Max inclusive days for stats/analytics API ranges (matches UI). */
export const BREVO_SMTP_STATS_MAX_RANGE_DAYS = 30

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

/** Brevo rejects endDate after their calendar "today". Prefer the viewer's local day. */
export function clampBrevoSmtpDateRange(
  startDate: string,
  endDate: string,
  now: Date = new Date(),
  tzOffsetMinutes?: number | null
): { startDate: string; endDate: string } {
  const offset =
    typeof tzOffsetMinutes === 'number' && Number.isFinite(tzOffsetMinutes)
      ? tzOffsetMinutes
      : 0
  const todayLocal = new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10)
  const end = endDate > todayLocal ? todayLocal : endDate
  const start = startDate > end ? end : startDate
  return { startDate: start, endDate: end }
}

/** Cap inclusive day span (pull start forward). */
export function clampBrevoSmtpStatsRangeToMaxDays(
  startDate: string,
  endDate: string,
  maxDays: number = BREVO_SMTP_STATS_MAX_RANGE_DAYS
): { startDate: string; endDate: string } {
  const start = parseYmdUtc(startDate)
  const end = parseYmdUtc(endDate)
  if (!start || !end || maxDays < 1 || start.getTime() > end.getTime()) {
    return { startDate, endDate }
  }
  const spanDays =
    Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
  if (spanDays <= maxDays) return { startDate, endDate }
  return {
    startDate: addUtcDays(endDate, -(maxDays - 1)),
    endDate
  }
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
