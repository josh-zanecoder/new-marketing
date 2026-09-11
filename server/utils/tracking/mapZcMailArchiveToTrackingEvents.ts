import { normalizeBrevoWebhookEventName } from '@server/utils/tracking/parseBrevoTransactionalWebhookPayload'
import { zcMailObjectTagsToBrevoTagList, zcMailTagsAreCampaignTestSend } from '@server/utils/zcmail/campaignZcMailTags'
import type {
  ZcMailArchiveDetail,
  ZcMailArchiveListItem
} from '@server/utils/zcmail/types/zcMailArchive'
import type { BrevoTrackingEmailEvent } from '@server/utils/tracking/brevoTenantEvents'

function toDayKey(isoOrDate: string): string | null {
  const d = new Date(isoOrDate)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

export function zcMailArchiveInDateRange(
  createdAt: string,
  fromYmd?: string | null,
  toYmd?: string | null
): boolean {
  const day = toDayKey(createdAt)
  if (!day) return false
  if (fromYmd && day < fromYmd) return false
  if (toYmd && day > toYmd) return false
  return true
}

export function zcMailArchiveLookupIds(item: {
  id?: string
  messageId?: string
  sesMessageId?: string
}): string[] {
  const ids = [item.sesMessageId, item.messageId, item.id]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
  return [...new Set(ids)]
}

export function canonicalZcMailArchiveMessageId(item: {
  id?: string
  messageId?: string
  sesMessageId?: string
}): string {
  return (
    String(item.sesMessageId || '').trim() ||
    String(item.messageId || '').trim() ||
    String(item.id || '').trim()
  )
}

function mapSesOrArchiveEventName(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  const key = t.toLowerCase().replace(/[-\s]+/g, '_')
  const ses: Record<string, string> = {
    send: 'requests',
    delivery: 'delivered',
    bounce: 'hardBounces',
    bounced: 'hardBounces',
    complaint: 'spam',
    open: 'opened',
    click: 'clicks',
    reject: 'blocked',
    renderingfailure: 'error',
    rendering_failure: 'error',
    deliverydelay: 'deferred',
    delivery_delay: 'deferred',
    subscription: 'unsubscribed',
    failed: 'hardBounces',
    sent: 'delivered'
  }
  if (ses[key]) return ses[key]
  return normalizeBrevoWebhookEventName(t) || t
}

function eventDate(raw: string | null | undefined, fallback: string): string {
  const value = String(raw || '').trim()
  if (value) {
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString()
  }
  const fallbackParsed = Date.parse(fallback)
  if (Number.isFinite(fallbackParsed)) return new Date(fallbackParsed).toISOString()
  return new Date().toISOString()
}

export function zcMailArchiveTagsRecord(
  item: Pick<ZcMailArchiveListItem, 'tags'> & { tags?: Record<string, string> }
): Record<string, string> {
  return item.tags && typeof item.tags === 'object' ? item.tags : {}
}

export function zcMailArchiveBelongsToScope(
  item: Pick<ZcMailArchiveListItem, 'tags' | 'recipient' | 'to' | 'id' | 'messageId' | 'sesMessageId'> & {
    tags?: Record<string, string>
  },
  params: {
    dbName: string
    campaignId?: string | null
    routedCampaignId?: string | null
    routedDbName?: string | null
    campaignMessageIds?: Set<string> | null
  }
): boolean {
  const tags = zcMailArchiveTagsRecord(item)
  const source = (tags.source || '').trim().toLowerCase()
  if (source.startsWith('mortdash-crm') || source.includes('ratesheet')) return false

  const campaignId = params.campaignId?.trim() || ''
  const tagCampaign = (tags.campaign || '').trim()
  const tagDb = (tags.db || '').trim()
  const routedCampaign = params.routedCampaignId?.trim() || ''
  const routedDb = params.routedDbName?.trim() || ''

  if (tagDb && tagDb !== params.dbName) return false
  if (routedDb && routedDb !== params.dbName) return false

  if (!campaignId) return true

  // Test emails are tagged with this campaign id but are not the campaign send.
  if (zcMailTagsAreCampaignTestSend(tags)) return false

  if (tagCampaign) return tagCampaign === campaignId
  if (routedCampaign) return routedCampaign === campaignId

  const ids = zcMailArchiveLookupIds(item)
  if (params.campaignMessageIds && params.campaignMessageIds.size > 0) {
    for (const id of ids) {
      if (params.campaignMessageIds.has(id)) return true
      const stripped = id.replace(/^<|>$/g, '')
      if (stripped && params.campaignMessageIds.has(stripped)) return true
    }
  }

  return false
}

function toTrackingEvent(params: {
  email: string
  date: string
  messageId: string
  event: string
  tag: string
  subject: string
  from: string
  reason?: string
}): BrevoTrackingEmailEvent {
  return {
    email: params.email,
    date: params.date,
    messageId: params.messageId,
    event: params.event,
    tag: params.tag,
    subject: params.subject,
    from: params.from,
    reason: params.reason || ''
  }
}

function statusFallbackEvents(item: ZcMailArchiveListItem, tag: string): BrevoTrackingEmailEvent[] {
  const messageId = canonicalZcMailArchiveMessageId(item)
  const email = item.recipient || item.to?.[0] || ''
  const date = eventDate(item.createdAt, item.createdAt)
  const status = String(item.status || '').trim().toLowerCase()
  const base = {
    email,
    date,
    messageId,
    tag,
    subject: item.subject || '',
    from: item.from || ''
  }
  const events: BrevoTrackingEmailEvent[] = [
    toTrackingEvent({ ...base, event: 'requests' })
  ]
  if (status === 'sent') {
    events.push(toTrackingEvent({ ...base, event: 'delivered' }))
  } else if (status === 'failed') {
    events.push(
      toTrackingEvent({
        ...base,
        event: 'hardBounces',
        reason: item.error || ''
      })
    )
  }
  return events
}

function mapDetailEvents(
  item: ZcMailArchiveDetail,
  tag: string
): BrevoTrackingEmailEvent[] {
  const messageId = canonicalZcMailArchiveMessageId(item)
  const fallbackEmail = item.recipient || item.to?.[0] || ''
  const out: BrevoTrackingEmailEvent[] = []
  const seen = new Set<string>()

  for (const ev of item.events || []) {
    const event = mapSesOrArchiveEventName(ev.status || ev.eventType || '')
    if (!event) continue
    const date = eventDate(ev.eventTimestamp || ev.createdAt || null, item.createdAt)
    const key = `${event}|${date}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(
      toTrackingEvent({
        email: ev.recipient || fallbackEmail,
        date,
        messageId,
        event,
        tag,
        subject: ev.subject || item.subject || '',
        from: item.from || '',
        reason: ev.smtpResponse || item.error || ''
      })
    )
  }

  if (out.length === 0) return statusFallbackEvents(item, tag)

  const hasRequests = out.some((row) => row.event === 'requests')
  if (!hasRequests) {
    out.unshift(
      toTrackingEvent({
        email: fallbackEmail,
        date: eventDate(item.createdAt, item.createdAt),
        messageId,
        event: 'requests',
        tag,
        subject: item.subject || '',
        from: item.from || ''
      })
    )
  }
  return out
}

export function mapZcMailArchiveItemToTrackingEvents(
  item: ZcMailArchiveListItem | ZcMailArchiveDetail
): BrevoTrackingEmailEvent[] {
  const messageId = canonicalZcMailArchiveMessageId(item)
  if (!messageId) return []
  const tagList = zcMailObjectTagsToBrevoTagList(zcMailArchiveTagsRecord(item))
  const tag = tagList.join('|')
  if ('events' in item && Array.isArray((item as ZcMailArchiveDetail).events)) {
    return mapDetailEvents(item as ZcMailArchiveDetail, tag).filter(
      (row) => (row.messageId || '').trim() && (row.event || '').trim() && (row.date || '').trim()
    )
  }
  return statusFallbackEvents(item, tag).filter(
    (row) => (row.messageId || '').trim() && (row.event || '').trim() && (row.date || '').trim()
  )
}

export function mergeZcMailArchiveTags(
  item: ZcMailArchiveListItem,
  extra?: Record<string, string>
): ZcMailArchiveListItem {
  const tags = { ...zcMailArchiveTagsRecord(item), ...(extra || {}) }
  return Object.keys(tags).length ? { ...item, tags } : item
}

/** Used when routing knows campaign/db/user but archive row has no tags. */
export function withScopedZcMailArchiveTags(
  item: ZcMailArchiveListItem,
  params: { dbName: string; campaignId?: string | null; userEmail?: string | null }
): ZcMailArchiveListItem {
  const existing = zcMailArchiveTagsRecord(item)
  const extra: Record<string, string> = {}
  if (!existing.db && params.dbName) extra.db = params.dbName
  if (!existing.campaign && params.campaignId?.trim()) extra.campaign = params.campaignId.trim()
  const user = String(params.userEmail || '')
    .trim()
    .toLowerCase()
  if (!existing.user && user.includes('@')) extra.user = user
  return mergeZcMailArchiveTags(item, extra)
}

export function mapZcMailArchiveEventName(raw: string): string {
  return mapSesOrArchiveEventName(raw)
}
