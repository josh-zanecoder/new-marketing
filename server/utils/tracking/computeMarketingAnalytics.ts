import type { BrevoTrackingEmailEvent } from './brevoTenantEvents'

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

export interface MarketingAnalyticsResult {
  summary: MarketingAnalyticsSummary
  timeseries: MarketingAnalyticsTimeseriesPoint[]
}

interface DayBucket {
  sent: Set<string>
  delivered: Set<string>
  opened: Set<string>
  clicked: Set<string>
  bounced: Set<string>
  unsubscribed: Set<string>
}

function normalizeEventType(event: string | undefined): string {
  return (event || '').trim().toLowerCase()
}

function messageKey(ev: BrevoTrackingEmailEvent): string {
  const mid = ev.messageId?.trim()
  if (mid) return `msg:${mid}`
  const email = (ev.email || '').trim().toLowerCase()
  const date = (ev.date || '').trim()
  return `fallback:${email}:${date}:${normalizeEventType(ev.event)}`
}

function isSentEvent(type: string): boolean {
  return type === 'requests' || type === 'sent' || type === 'request'
}

function isDeliveredEvent(type: string): boolean {
  return type === 'delivered'
}

function isOpenEvent(type: string): boolean {
  return type === 'unique_opened' || type === 'opened' || type === 'open' || type.includes('open')
}

function isClickEvent(type: string): boolean {
  return type === 'clicks' || type === 'click' || type.includes('click')
}

function isBounceEvent(type: string): boolean {
  return type.includes('bounce')
}

function isUnsubscribeEvent(type: string): boolean {
  return type === 'unsubscribed' || type === 'unsubscribe' || type.includes('unsub')
}

function toYmdLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseEventYmd(iso: string | undefined): string | null {
  if (!iso?.trim()) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return toYmdLocal(d)
}

function inputYmdToStartMs(ymd: string): number | null {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d).getTime()
}

function enumerateDays(fromYmd: string, toYmd: string): string[] {
  const fromMs = inputYmdToStartMs(fromYmd)
  const toMs = inputYmdToStartMs(toYmd)
  if (fromMs == null || toMs == null || fromMs > toMs) return []

  const out: string[] = []
  const cursor = new Date(fromMs)
  const end = new Date(toMs)
  while (cursor.getTime() <= end.getTime()) {
    out.push(toYmdLocal(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

function eventInYmdRange(ymd: string, fromYmd: string | null, toYmd: string | null): boolean {
  if (!fromYmd && !toYmd) return true
  const dayMs = inputYmdToStartMs(ymd)
  if (dayMs == null) return false
  const fromMs = fromYmd ? inputYmdToStartMs(fromYmd) : null
  const toMs = toYmd ? inputYmdToStartMs(toYmd) : null
  if (fromMs != null && dayMs < fromMs) return false
  if (toMs != null && dayMs > toMs) return false
  return true
}

function createEmptyBucket(): DayBucket {
  return {
    sent: new Set(),
    delivered: new Set(),
    opened: new Set(),
    clicked: new Set(),
    bounced: new Set(),
    unsubscribed: new Set()
  }
}

function applyEventToBucket(bucket: DayBucket, ev: BrevoTrackingEmailEvent) {
  const type = normalizeEventType(ev.event)
  const key = messageKey(ev)
  if (isSentEvent(type)) bucket.sent.add(key)
  if (isDeliveredEvent(type)) bucket.delivered.add(key)
  if (isOpenEvent(type)) bucket.opened.add(key)
  if (isClickEvent(type)) bucket.clicked.add(key)
  if (isBounceEvent(type)) bucket.bounced.add(key)
  if (isUnsubscribeEvent(type)) bucket.unsubscribed.add(key)
}

function ratesFromBucket(bucket: DayBucket): Omit<MarketingAnalyticsTimeseriesPoint, 'date'> {
  const sent = bucket.sent.size
  const delivered = bucket.delivered.size
  const opened = bucket.opened.size
  const clicked = bucket.clicked.size
  const bounced = bucket.bounced.size
  const unsubscribed = bucket.unsubscribed.size

  return {
    emailsSent: sent,
    emailsDelivered: delivered,
    openRate: delivered > 0 ? (opened / delivered) * 100 : null,
    clickRate: delivered > 0 ? (clicked / delivered) * 100 : null,
    bounceRate: sent > 0 ? (bounced / sent) * 100 : null,
    unsubscribeRate: delivered > 0 ? (unsubscribed / delivered) * 100 : null
  }
}

function summaryFromBucket(bucket: DayBucket): MarketingAnalyticsSummary {
  const metrics = ratesFromBucket(bucket)
  return {
    emailsSent: metrics.emailsSent,
    emailsDelivered: metrics.emailsDelivered,
    uniqueOpens: bucket.opened.size,
    uniqueClicks: bucket.clicked.size,
    bounces: bucket.bounced.size,
    unsubscribes: bucket.unsubscribed.size,
    openRate: metrics.openRate,
    clickRate: metrics.clickRate,
    bounceRate: metrics.bounceRate,
    unsubscribeRate: metrics.unsubscribeRate
  }
}

function resolveDayLabels(events: BrevoTrackingEmailEvent[], fromYmd: string | null, toYmd: string | null): string[] {
  if (fromYmd && toYmd) return enumerateDays(fromYmd, toYmd)

  const days = new Set<string>()
  for (const ev of events) {
    const ymd = parseEventYmd(ev.date)
    if (ymd && eventInYmdRange(ymd, fromYmd, toYmd)) days.add(ymd)
  }
  const sorted = [...days].sort()
  if (sorted.length <= 1) return sorted
  return enumerateDays(sorted[0], sorted[sorted.length - 1])
}

export function computeMarketingAnalytics(
  events: BrevoTrackingEmailEvent[],
  fromYmd: string | null,
  toYmd: string | null
): MarketingAnalyticsResult {
  const filtered = events.filter((ev) => {
    const ymd = parseEventYmd(ev.date)
    if (!ymd) return false
    return eventInYmdRange(ymd, fromYmd, toYmd)
  })

  const dayLabels = resolveDayLabels(filtered, fromYmd, toYmd)
  const buckets = new Map<string, DayBucket>()
  for (const day of dayLabels) {
    buckets.set(day, createEmptyBucket())
  }

  const summaryBucket = createEmptyBucket()

  for (const ev of filtered) {
    const ymd = parseEventYmd(ev.date)
    if (!ymd) continue
    applyEventToBucket(summaryBucket, ev)
    const dayBucket = buckets.get(ymd)
    if (dayBucket) applyEventToBucket(dayBucket, ev)
  }

  const timeseries = dayLabels.map((date) => ({
    date,
    ...ratesFromBucket(buckets.get(date) ?? createEmptyBucket())
  }))

  return {
    summary: summaryFromBucket(summaryBucket),
    timeseries
  }
}
