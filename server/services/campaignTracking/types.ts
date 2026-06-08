export type CampaignTrackingSummary = {
  source: 'webhook' | 'empty'
  totals: {
    sent: number
    delivered: number
    opened: number
    clicked: number
    bounced: number
    complained: number
    unsubscribed: number
  }
  rates: {
    deliveryRate: number | null
    openRate: number | null
    clickRate: number | null
  }
  funnel: Array<{ label: string; count: number; pct: number | null }>
}

export type CampaignTrackingTimeseriesPoint = {
  date: string
  delivered: number
  opened: number
  clicked: number
  bounced: number
  other: number
}

export type StoredEmailEventRecord = {
  email: string
  event: string
  occurredAt: string
  reason?: string
  link?: string
  tag?: string
  brevoMessageId: string
}

export type TrackingEventReport = {
  events: Array<{
    email: string
    event: string
    date: string
    tag?: string
    messageId?: string
  }>
}
