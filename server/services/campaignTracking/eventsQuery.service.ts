import type { TenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { CampaignEmailEventModel } from '@server/types/tenant/campaignEmailEvent.model'
import type { CampaignModel } from '@server/types/tenant/campaign.model'
import type { StoredEmailEventRecord, TrackingEventReport } from './types'

type StoredEmailEventLean = {
  email: string
  event: string
  occurredAt: Date
  reason?: string
  link?: string
  tag?: string
  brevoMessageId: string
}

function mapStoredEmailEventRow(row: StoredEmailEventLean): StoredEmailEventRecord {
  return {
    email: row.email,
    event: row.event,
    occurredAt: new Date(row.occurredAt).toISOString(),
    ...(row.reason ? { reason: row.reason } : {}),
    ...(row.link ? { link: row.link } : {}),
    ...(row.tag ? { tag: row.tag } : {}),
    brevoMessageId: row.brevoMessageId
  }
}

export function storedEventsToReportShape(items: StoredEmailEventRecord[]): TrackingEventReport {
  return {
    events: items.map((item) => ({
      email: item.email,
      event: item.event,
      date: item.occurredAt,
      ...(item.tag ? { tag: item.tag } : {}),
      ...(item.brevoMessageId ? { messageId: item.brevoMessageId } : {})
    }))
  }
}

/** @deprecated Use `storedEventsToReportShape`. */
export const storedEventsToBrevoReportShape = storedEventsToReportShape

export async function listStoredTenantEmailEvents(
  models: TenantClientModels,
  campaignFilter: Record<string, unknown>,
  params: { limit: number }
): Promise<{ total: number; items: StoredEmailEventRecord[] }> {
  const CampaignModel = models.Campaign as CampaignModel
  const EventModel = models.CampaignEmailEvent as CampaignEmailEventModel

  const accessibleCampaigns = await CampaignModel.find(campaignFilter).select('_id').lean()
  const campaignIds = accessibleCampaigns.map((row) => row._id)
  if (campaignIds.length === 0) {
    return { total: 0, items: [] }
  }

  const filter = { campaign: { $in: campaignIds } }
  const limit = Math.max(1, Math.min(params.limit, 1000))

  const [items, total] = await Promise.all([
    EventModel.find(filter).sort({ occurredAt: -1 }).limit(limit).lean(),
    EventModel.countDocuments(filter)
  ])

  return {
    total,
    items: items.map((row) => mapStoredEmailEventRow(row as StoredEmailEventLean))
  }
}

export async function listStoredCampaignEmailEvents(
  models: TenantClientModels,
  params: {
    campaignId: string
    page: number
    limit: number
    search?: string
    event?: string
  }
): Promise<{
  page: number
  limit: number
  total: number
  totalPages: number
  items: StoredEmailEventRecord[]
}> {
  const EventModel = models.CampaignEmailEvent as CampaignEmailEventModel
  const filter: Record<string, unknown> = { campaign: params.campaignId }
  if (params.event?.trim()) filter.event = params.event.trim().toLowerCase()
  if (params.search?.trim()) {
    filter.email = { $regex: params.search.trim(), $options: 'i' }
  }

  const [items, total] = await Promise.all([
    EventModel.find(filter)
      .sort({ occurredAt: -1 })
      .skip((params.page - 1) * params.limit)
      .limit(params.limit)
      .lean(),
    EventModel.countDocuments(filter)
  ])

  return {
    page: params.page,
    limit: params.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / params.limit)),
    items: items.map((row) => mapStoredEmailEventRow(row as StoredEmailEventLean))
  }
}
