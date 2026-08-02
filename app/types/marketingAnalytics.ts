export interface MarketingAnalyticsSummary {
  emailsSent: number
  emailsDelivered: number
  uniqueOpens: number
  uniqueClicks: number
  bounces: number
  unsubscribes: number
  openRate: number | null
  clickRate: number | null
  bounceRate: number | null
  unsubscribeRate: number | null
}

export interface MarketingAnalyticsTimeseriesPoint {
  date: string
  emailsSent: number
  emailsDelivered: number
  openRate: number | null
  clickRate: number | null
  bounceRate: number | null
  unsubscribeRate: number | null
}

export interface MarketingAnalyticsEventItem {
  email: string
  date: string
  subject: string
  messageId: string
  event: string
  from: string
  reason?: string
}

export interface MarketingAnalyticsPayload {
  summary: MarketingAnalyticsSummary
  timeseries: MarketingAnalyticsTimeseriesPoint[]
  /** Ratesheet-style paginated raw events (not aggregated by recipient). */
  events?: {
    items: MarketingAnalyticsEventItem[]
    limit: number
    offset: number
    hasMore: boolean
  }
  /** Counts for event-type filter pills (from aggregated SMTP report). */
  eventTypeCounts?: Record<string, number>
  /** Distinct owner emails for the User filter (session scope). */
  tagUsers?: string[]
  /** Session may pass `userEmail` to narrow analytics. */
  allowUserTagFilter?: boolean
}

export interface MarketingAnalyticsMetricCard {
  id: string
  label: string
  value: string
  hint?: string
  accentClass: string
  iconBgClass: string
  iconClass: string
  cardClass: string
}
