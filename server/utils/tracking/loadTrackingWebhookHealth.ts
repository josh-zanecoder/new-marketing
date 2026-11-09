import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { getTenantConnectionByDbName } from '@server/tenant/connection'

const STALE_AFTER_MS = 24 * 60 * 60 * 1000

export type TrackingWebhookHealth = {
  lastEventAt: string | null
  lastEventType: string | null
  lastWrittenAt: string | null
  eventsLast24h: number
  stale: boolean
  staleSinceHours: number | null
}

/**
 * Lightweight freshness signal for Tracking: last Mongo event + 24h volume.
 * Webhooks and archive Refresh both write the same collection.
 */
export async function loadTrackingWebhookHealth(
  dbName: string,
  options?: { campaignId?: string | null }
): Promise<TrackingWebhookHealth> {
  const conn = await getTenantConnectionByDbName(dbName)
  const { BrevoTrackingEvent } = getTenantClientModels(conn)

  const filter: Record<string, unknown> = {}
  const campaignId = options?.campaignId?.trim()
  if (campaignId) filter.campaignId = campaignId

  const since = new Date(Date.now() - STALE_AFTER_MS)

  const [lastByEventAt, lastByCreatedAt, eventsLast24h] = await Promise.all([
    BrevoTrackingEvent.findOne(filter)
      .sort({ eventAt: -1 })
      .select({ eventAt: 1, event: 1 })
      .lean()
      .exec() as Promise<{ eventAt?: Date; event?: string } | null>,
    BrevoTrackingEvent.findOne(filter)
      .sort({ createdAt: -1 })
      .select({ createdAt: 1 })
      .lean()
      .exec() as Promise<{ createdAt?: Date } | null>,
    BrevoTrackingEvent.countDocuments({
      ...filter,
      $or: [{ eventAt: { $gte: since } }, { createdAt: { $gte: since } }]
    })
  ])

  const lastEventAt =
    lastByEventAt?.eventAt instanceof Date
      ? lastByEventAt.eventAt.toISOString()
      : lastByEventAt?.eventAt
        ? new Date(lastByEventAt.eventAt).toISOString()
        : null
  const lastWrittenAt =
    lastByCreatedAt?.createdAt instanceof Date
      ? lastByCreatedAt.createdAt.toISOString()
      : lastByCreatedAt?.createdAt
        ? new Date(lastByCreatedAt.createdAt).toISOString()
        : null

  const freshnessMs = lastWrittenAt
    ? Date.now() - Date.parse(lastWrittenAt)
    : lastEventAt
      ? Date.now() - Date.parse(lastEventAt)
      : null
  const stale =
    freshnessMs == null || !Number.isFinite(freshnessMs) || freshnessMs > STALE_AFTER_MS
  const staleSinceHours =
    freshnessMs != null && Number.isFinite(freshnessMs)
      ? Math.max(0, Math.round(freshnessMs / (60 * 60 * 1000)))
      : null

  return {
    lastEventAt,
    lastEventType: lastByEventAt?.event ? String(lastByEventAt.event) : null,
    lastWrittenAt,
    eventsLast24h: Number(eventsLast24h) || 0,
    stale,
    staleSinceHours
  }
}
