export type ContactEngagementKind =
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'bounced'
  | 'unsubscribed'
  | 'complaint'
  | 'failed'

export type ContactEngagementEvent = {
  id: string
  at: string
  kind: ContactEngagementKind
  label: string
  subject: string
  campaignId: string
  campaignName: string
  link: string
  reason: string
}

export type ContactEngagementSummary = {
  sent: number
  delivered: number
  opened: number
  clicked: number
}

export type ContactEngagementSource = {
  id: string
  event: string
  eventAt?: Date | string | null
  date?: string | null
  messageId?: string | null
  subject?: string | null
  campaignId?: string | null
  link?: string | null
  reason?: string | null
}

const LABELS: Record<ContactEngagementKind, string> = {
  sent: 'Sent',
  delivered: 'Delivered',
  opened: 'Opened',
  clicked: 'Clicked',
  bounced: 'Bounced',
  unsubscribed: 'Unsubscribed',
  complaint: 'Marked as spam',
  failed: 'Failed'
}

function normalizeEventName(raw: string): string {
  return raw.trim().toLowerCase().replace(/[_\s-]+/g, '')
}

export function classifyTrackingEvent(raw: string): ContactEngagementKind | null {
  const name = normalizeEventName(raw)
  if (!name) return null
  if (name === 'sent' || name === 'request' || name === 'requests') return 'sent'
  if (name === 'delivered') return 'delivered'
  if (
    name === 'bounce' ||
    name === 'bounces' ||
    name === 'hardbounce' ||
    name === 'hardbounces' ||
    name === 'softbounce' ||
    name === 'softbounces'
  ) {
    return 'bounced'
  }
  if (name === 'blocked' || name === 'invalid' || name === 'error' || name === 'deferred') return 'failed'
  if (name === 'spam' || name === 'complaint') return 'complaint'
  if (name === 'unsubscribed' || name === 'unsubscribe') return 'unsubscribed'
  if (name === 'click' || name === 'clicks' || name === 'clicked' || name === 'uniqueclicked' || name === 'uniqueclick') {
    return 'clicked'
  }
  if (name.includes('open') || name === 'loadedbyproxy' || name === 'firstopening') return 'opened'
  return null
}

function eventTime(row: ContactEngagementSource): number | null {
  if (row.eventAt instanceof Date && Number.isFinite(row.eventAt.getTime())) return row.eventAt.getTime()
  if (typeof row.eventAt === 'string' && row.eventAt.trim()) {
    const parsed = new Date(row.eventAt)
    if (Number.isFinite(parsed.getTime())) return parsed.getTime()
  }
  if (typeof row.date === 'string' && row.date.trim()) {
    const parsed = new Date(row.date)
    if (Number.isFinite(parsed.getTime())) return parsed.getTime()
  }
  return null
}

function isProxyOpen(raw: string): boolean {
  return normalizeEventName(raw).includes('proxy')
}

/**
 * One row per thing that happened. Repeat opens of the same email collapse to the first real open.
 * Clicks stay separate when the link is different.
 */
export function buildContactEngagementTimeline(
  rows: ContactEngagementSource[],
  campaignNames: ReadonlyMap<string, string> = new Map(),
  limit = 80
): { events: ContactEngagementEvent[]; summary: ContactEngagementSummary } {
  type Folded = ContactEngagementEvent & { atMs: number; messageId: string; proxy: boolean }
  const byKey = new Map<string, Folded>()

  for (const row of rows) {
    const kind = classifyTrackingEvent(row.event)
    const atMs = eventTime(row)
    if (!kind || atMs == null) continue
    const messageId = String(row.messageId || '').trim()
    const link = kind === 'clicked' ? String(row.link || '').trim() : ''
    const key = `${messageId}|${kind}|${link}`
    const proxy = kind === 'opened' && isProxyOpen(row.event)
    const existing = byKey.get(key)
    if (existing) {
      if (kind === 'opened' && !existing.proxy && proxy) continue
      if (!(kind === 'opened' && existing.proxy && !proxy) && existing.atMs <= atMs) continue
    }
    const campaignId = String(row.campaignId || '').trim()
    byKey.set(key, {
      id: String(row.id || key),
      at: new Date(atMs).toISOString(),
      atMs,
      kind,
      label: LABELS[kind],
      subject: String(row.subject || '').trim() || 'No subject',
      campaignId,
      campaignName: campaignNames.get(campaignId) || '',
      link,
      reason: String(row.reason || '').trim(),
      messageId,
      proxy
    })
  }

  const realOpens = new Set(
    [...byKey.values()].filter((row) => row.kind === 'opened' && !row.proxy).map((row) => row.messageId)
  )

  const events = [...byKey.values()]
    .filter((row) => !(row.kind === 'opened' && row.proxy && realOpens.has(row.messageId)))
    .sort((a, b) => b.atMs - a.atMs)
    .slice(0, limit)
    .map(({ atMs: _atMs, messageId: _messageId, proxy: _proxy, ...event }) => event)

  const summary: ContactEngagementSummary = { sent: 0, delivered: 0, opened: 0, clicked: 0 }
  for (const event of events) {
    if (event.kind === 'sent') summary.sent += 1
    else if (event.kind === 'delivered') summary.delivered += 1
    else if (event.kind === 'opened') summary.opened += 1
    else if (event.kind === 'clicked') summary.clicked += 1
  }

  return { events, summary }
}
