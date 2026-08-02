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

export type BrevoTransactionalStats = {
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

export type BrevoSmtpPerformanceRow = {
  label: string
  pct: number
  variant: 'blue' | 'teal' | 'green' | 'amber' | 'red' | 'orange' | 'brown' | 'slate'
  valueDisplay: 'percent' | 'count'
  countValue?: number
}
