import type {
  BrevoSmtpAggregated,
  BrevoSmtpDailyRow
} from '@server/utils/tracking/fetchBrevoTransactionalStats'
import { marketingAnalyticsFromSmtpStats } from '@server/utils/tracking/marketingAnalyticsFromSmtpStats'
import type { MarketingAnalyticsResult } from '@server/utils/tracking/computeMarketingAnalytics'

const COUNT_KEYS = [
  'requests',
  'delivered',
  'hardBounces',
  'softBounces',
  'opens',
  'uniqueOpens',
  'clicks',
  'uniqueClicks',
  'blocked',
  'invalid',
  'spamReports',
  'unsubscribed'
] as const

function zeroRates(): BrevoSmtpAggregated['rates'] {
  return {
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
    rates: zeroRates()
  }
}

function emptyDaily(date: string): BrevoSmtpDailyRow {
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

export function sumBrevoSmtpAggregated(rows: BrevoSmtpAggregated[]): BrevoSmtpAggregated {
  const total = emptyAggregated()
  for (const row of rows) {
    for (const key of COUNT_KEYS) total[key] += row[key] ?? 0
  }
  return total
}

export function mergeBrevoSmtpDaily(groups: BrevoSmtpDailyRow[][]): BrevoSmtpDailyRow[] {
  const byDate = new Map<string, BrevoSmtpDailyRow>()
  for (const group of groups) {
    for (const row of group) {
      const current = byDate.get(row.date) ?? emptyDaily(row.date)
      for (const key of COUNT_KEYS) current[key] += row[key] ?? 0
      byDate.set(row.date, current)
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

/** Combined opens, clicks, and delivery rates from per-tenant SMTP totals. */
export function rollupAdminAnalytics(
  rows: Array<{ aggregated: BrevoSmtpAggregated; daily: BrevoSmtpDailyRow[] }>
): MarketingAnalyticsResult {
  return marketingAnalyticsFromSmtpStats(
    sumBrevoSmtpAggregated(rows.map((row) => row.aggregated)),
    mergeBrevoSmtpDaily(rows.map((row) => row.daily))
  )
}
