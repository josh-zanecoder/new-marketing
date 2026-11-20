import type { BrevoSmtpAggregated } from '@server/utils/tracking/fetchBrevoTransactionalStats'

function pct(num: number, den: number): number {
  if (den <= 0) return 0
  return Math.round((num / den) * 10000) / 100
}

/** Recompute rate percentages after overriding `requests` (Sent). */
export function withBrevoSmtpRequestsCount(
  aggregated: BrevoSmtpAggregated,
  requests: number
): BrevoSmtpAggregated {
  const safeRequests = Math.max(0, Math.floor(Number(requests) || 0))
  const next = { ...aggregated, requests: safeRequests, rates: { ...aggregated.rates } }
  next.rates = {
    deliveredPct: pct(next.delivered, safeRequests),
    uniqueOpensPct: pct(next.uniqueOpens, safeRequests),
    opensPct: pct(next.opens, safeRequests),
    uniqueClicksPct: pct(next.uniqueClicks, safeRequests),
    hardBouncesPct: pct(next.hardBounces, safeRequests),
    softBouncesPct: pct(next.softBounces, safeRequests),
    blockedPct: pct(next.blocked, safeRequests),
    invalidPct: pct(next.invalid, safeRequests),
    spamReportsPct: pct(next.spamReports, safeRequests),
    unsubscribedPct: pct(next.unsubscribed, safeRequests)
  }
  return next
}
