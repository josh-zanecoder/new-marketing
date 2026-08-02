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

export interface MarketingAnalyticsPayload {
  summary: MarketingAnalyticsSummary
  timeseries: MarketingAnalyticsTimeseriesPoint[]
  /** Raw events for the recipients table (same scope as summary/chart). */
  events?: Array<{
    email?: string
    date?: string
    messageId?: string
    event?: string
    subject?: string
    tag?: string
  }>
  /** Distinct `user:{email}` tags in the ownership-scoped event set (before optional user filter). */
  tagUsers?: string[]
  /** Session may pass `userEmail` to narrow analytics (tenant-wide contacts only). */
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
