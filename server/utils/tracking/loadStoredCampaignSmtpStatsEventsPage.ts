import type { FilterQuery } from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { getTenantConnectionByDbName } from '@server/tenant/connection'
import type { BrevoEmailEventType } from '@server/utils/tracking/brevoEventType'
import { parseYmdToUtcBounds } from '@server/utils/tracking/brevoTrackingEventDateBounds'
import type { BrevoSmtpStatsEventItem } from '@server/utils/tracking/fetchBrevoTransactionalStats'

type StoredEventLean = {
  email?: string
  date?: string
  subject?: string
  messageId?: string
  event?: string
  from?: string
  reason?: string
  eventAt?: Date | null
}

/** Brevo UI / API type → Mongo `event` values we may have stored. */
function mongoEventValuesForFilter(eventType: string | null): string[] | null {
  if (!eventType?.trim()) return null
  const t = eventType.trim().toLowerCase()
  if (t === 'requests' || t === 'sent' || t === 'request') {
    return ['requests', 'sent', 'request']
  }
  if (t === 'opened' || t === 'opens' || t === 'open') {
    return ['opened', 'open', 'opens', 'unique_opened', 'uniqueopened']
  }
  if (t === 'clicks' || t === 'click' || t === 'clicked') {
    return ['clicks', 'click', 'clicked']
  }
  if (t === 'hardbounces' || t === 'hard_bounces') {
    return ['hardBounces', 'hard_bounces', 'hardbounce']
  }
  if (t === 'softbounces' || t === 'soft_bounces') {
    return ['softBounces', 'soft_bounces', 'softbounce']
  }
  if (t === 'deferred') return ['deferred']
  if (t === 'blocked') return ['blocked']
  if (t === 'invalid') return ['invalid']
  if (t === 'spam') return ['spam', 'complaint']
  if (t === 'unsubscribed') return ['unsubscribed', 'unsubscribe']
  if (t === 'loadedbyproxy' || t === 'loaded_by_proxy') {
    return ['loadedByProxy', 'loaded_by_proxy']
  }
  if (t === 'error') return ['error']
  return [eventType.trim()]
}

/**
 * Paginated Messages rows from tenant `brevo_tracking_events` (fast Next/Prev).
 * Optional campaign / user scope for Analytics; campaign required for campaign Statistics.
 */
export async function loadStoredCampaignSmtpStatsEventsPage(params: {
  dbName: string
  campaignId?: string | null
  userEmail?: string | null
  startDate: string
  endDate: string
  eventType?: BrevoEmailEventType | string | null
  limit: number
  offset: number
}): Promise<{ items: BrevoSmtpStatsEventItem[]; hasMore: boolean }> {
  const campaignId = params.campaignId?.trim() || null
  const userEmail = params.userEmail?.trim().toLowerCase() || null
  const limit = Math.max(1, Math.min(50, params.limit))
  const offset = Math.max(0, params.offset)

  const conn = await getTenantConnectionByDbName(params.dbName)
  const { BrevoTrackingEvent } = getTenantClientModels(conn)

  const filter: FilterQuery<Record<string, unknown>> = {}
  if (campaignId) filter.campaignId = campaignId
  if (userEmail) filter.userEmail = userEmail

  const bounds = parseYmdToUtcBounds(params.startDate, params.endDate, null)
  if (bounds) {
    filter.eventAt = { $gte: bounds.start, $lte: bounds.end }
  }

  const eventValues = mongoEventValuesForFilter(params.eventType?.trim() || null)
  if (eventValues?.length === 1) {
    filter.event = eventValues[0]
  } else if (eventValues && eventValues.length > 1) {
    filter.event = { $in: eventValues }
  }

  const docs = (await BrevoTrackingEvent.find(filter)
    .select({
      email: 1,
      date: 1,
      subject: 1,
      messageId: 1,
      event: 1,
      from: 1,
      reason: 1,
      eventAt: 1
    })
    .sort({ eventAt: -1, date: -1 })
    .skip(offset)
    .limit(limit + 1)
    .lean()
    .exec()) as StoredEventLean[]

  const hasMore = docs.length > limit
  const page = hasMore ? docs.slice(0, limit) : docs

  const items: BrevoSmtpStatsEventItem[] = page.map((doc) => ({
    email: doc.email || '',
    date: doc.date || (doc.eventAt ? new Date(doc.eventAt).toISOString() : ''),
    subject: doc.subject || '',
    messageId: doc.messageId || '',
    event: doc.event || '',
    from: doc.from || '',
    reason: doc.reason || ''
  }))

  return { items, hasMore }
}
