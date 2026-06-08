import type { TenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { CampaignEmailEventModel } from '@server/types/tenant/campaignEmailEvent.model'
import { classifyEngagementEvent } from './classifyEngagementEvent'
import type { CampaignTrackingSummary, CampaignTrackingTimeseriesPoint } from './types'

export async function buildCampaignTrackingSummary(
  models: TenantClientModels,
  campaignId: string
): Promise<CampaignTrackingSummary> {
  const EventModel = models.CampaignEmailEvent as CampaignEmailEventModel
  const rows = await EventModel.find({ campaign: campaignId }).select('email event').lean()

  const recipientsByBucket = {
    sent: new Set<string>(),
    delivered: new Set<string>(),
    opened: new Set<string>(),
    clicked: new Set<string>(),
    bounced: new Set<string>(),
    complained: new Set<string>(),
    unsubscribed: new Set<string>()
  }

  for (const row of rows) {
    const email = String(row.email ?? '')
      .trim()
      .toLowerCase()
    if (!email) continue
    const bucket = classifyEngagementEvent(String(row.event ?? ''))
    if (bucket === 'other') continue
    recipientsByBucket[bucket].add(email)
  }

  const totals = {
    sent: recipientsByBucket.sent.size,
    delivered: recipientsByBucket.delivered.size,
    opened: recipientsByBucket.opened.size,
    clicked: recipientsByBucket.clicked.size,
    bounced: recipientsByBucket.bounced.size,
    complained: recipientsByBucket.complained.size,
    unsubscribed: recipientsByBucket.unsubscribed.size
  }

  const sentBaseline = totals.sent > 0 ? totals.sent : totals.delivered
  const deliveryRate =
    sentBaseline > 0 ? Math.min(100, (totals.delivered / sentBaseline) * 100) : null
  const openRate =
    totals.delivered > 0 ? Math.min(100, (totals.opened / totals.delivered) * 100) : null
  const clickRate =
    totals.opened > 0 ? Math.min(100, (totals.clicked / totals.opened) * 100) : null

  const funnel = [
    {
      label: 'Sent',
      count: totals.sent || sentBaseline,
      pct: sentBaseline > 0 ? 100 : null
    },
    {
      label: 'Delivered',
      count: totals.delivered,
      pct: sentBaseline > 0 ? Math.round((totals.delivered / sentBaseline) * 1000) / 10 : null
    },
    {
      label: 'Opened',
      count: totals.opened,
      pct:
        totals.delivered > 0
          ? Math.round((totals.opened / totals.delivered) * 1000) / 10
          : null
    },
    {
      label: 'Clicked',
      count: totals.clicked,
      pct:
        totals.opened > 0 ? Math.round((totals.clicked / totals.opened) * 1000) / 10 : null
    }
  ]

  return {
    source: rows.length > 0 ? 'webhook' : 'empty',
    totals,
    rates: {
      deliveryRate: deliveryRate != null ? Math.round(deliveryRate * 10) / 10 : null,
      openRate: openRate != null ? Math.round(openRate * 10) / 10 : null,
      clickRate: clickRate != null ? Math.round(clickRate * 10) / 10 : null
    },
    funnel
  }
}

export async function buildCampaignTrackingTimeseries(
  models: TenantClientModels,
  campaignId: string,
  days = 14
): Promise<{ points: CampaignTrackingTimeseriesPoint[] }> {
  const EventModel = models.CampaignEmailEvent as CampaignEmailEventModel
  const since = new Date()
  since.setUTCHours(0, 0, 0, 0)
  since.setUTCDate(since.getUTCDate() - Math.max(1, Math.min(days, 90)) + 1)

  const rows = await EventModel.aggregate<{
    _id: { day: string; event: string }
    count: number
  }>([
    { $match: { campaign: campaignId, occurredAt: { $gte: since } } },
    {
      $group: {
        _id: {
          day: {
            $dateToString: { format: '%Y-%m-%d', date: '$occurredAt', timezone: 'UTC' }
          },
          event: '$event'
        },
        count: { $sum: 1 }
      }
    }
  ])

  const byDay = new Map<string, CampaignTrackingTimeseriesPoint>()
  for (const row of rows) {
    const day = row._id?.day
    const event = String(row._id?.event ?? '')
    if (!day) continue
    if (!byDay.has(day)) {
      byDay.set(day, { date: day, delivered: 0, opened: 0, clicked: 0, bounced: 0, other: 0 })
    }
    const point = byDay.get(day)!
    const bucket = classifyEngagementEvent(event)
    if (bucket === 'delivered') point.delivered += row.count
    else if (bucket === 'opened') point.opened += row.count
    else if (bucket === 'clicked') point.clicked += row.count
    else if (bucket === 'bounced') point.bounced += row.count
    else point.other += row.count
  }

  return { points: [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)) }
}
