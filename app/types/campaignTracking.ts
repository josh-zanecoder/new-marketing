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

export type TrackingEmailEvent = {
  email?: string
  date?: string
  messageId?: string
  event?: string
  subject?: string
  tag?: string
  from?: string
  ip?: string
  link?: string
  reason?: string
  templateId?: number
}

export type TrackingEventReport = {
  events?: TrackingEmailEvent[]
}
