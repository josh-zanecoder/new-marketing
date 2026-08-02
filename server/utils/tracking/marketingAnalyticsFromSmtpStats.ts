import type {
  BrevoSmtpAggregated,
  BrevoSmtpDailyRow,
  BrevoSmtpStatsEventItem
} from '@server/utils/tracking/fetchBrevoTransactionalStats'
import type { MarketingAnalyticsResult } from '@server/utils/tracking/computeMarketingAnalytics'

function pct(num: number, den: number): number | null {
  if (den <= 0) return null
  return Math.round((num / den) * 10000) / 100
}

/** Map ratesheet-style Brevo SMTP aggregated + daily into Marketing Analytics shapes. */
export function marketingAnalyticsFromSmtpStats(
  aggregated: BrevoSmtpAggregated,
  daily: BrevoSmtpDailyRow[]
): MarketingAnalyticsResult {
  const emailsSent = aggregated.requests
  const emailsDelivered = aggregated.delivered
  const uniqueOpens = aggregated.uniqueOpens
  const uniqueClicks = aggregated.uniqueClicks
  const bounces = (aggregated.hardBounces ?? 0) + (aggregated.softBounces ?? 0)
  const unsubscribes = aggregated.unsubscribed

  return {
    summary: {
      emailsSent,
      emailsDelivered,
      uniqueOpens,
      uniqueClicks,
      bounces,
      unsubscribes,
      openRate: pct(uniqueOpens, emailsDelivered),
      clickRate: pct(uniqueClicks, emailsDelivered),
      bounceRate: pct(bounces, emailsSent),
      unsubscribeRate: pct(unsubscribes, emailsDelivered)
    },
    timeseries: daily.map((row) => {
      const sent = row.requests
      const delivered = row.delivered
      const dayBounces = (row.hardBounces ?? 0) + (row.softBounces ?? 0)
      return {
        date: row.date,
        emailsSent: sent,
        emailsDelivered: delivered,
        openRate: pct(row.uniqueOpens, delivered),
        clickRate: pct(row.uniqueClicks, delivered),
        bounceRate: pct(dayBounces, sent),
        unsubscribeRate: pct(row.unsubscribed, delivered)
      }
    })
  }
}

export type { BrevoSmtpStatsEventItem }
