import mongoose from 'mongoose'
import type { CampaignRecipientModel } from '@server/types/tenant/campaignRecipient.model'
import {
  CAMPAIGN_RECIPIENT_STATUS_CANCELLED,
  CAMPAIGN_RECIPIENT_STATUS_FAILED,
  CAMPAIGN_RECIPIENT_STATUS_PENDING,
  CAMPAIGN_RECIPIENT_STATUS_SENDING,
  CAMPAIGN_RECIPIENT_STATUS_SENT
} from './constants'

export type CampaignRecipientStatusCounts = {
  sent: number
  notSent: number
  cancelled: number
  pending: number
  failed: number
  sending: number
  total: number
}

function emptyCounts(): CampaignRecipientStatusCounts {
  return {
    sent: 0,
    notSent: 0,
    cancelled: 0,
    pending: 0,
    failed: 0,
    sending: 0,
    total: 0
  }
}

export function finalizeRecipientStatusCounts(partial: {
  sent?: number
  pending?: number
  sending?: number
  failed?: number
  cancelled?: number
}): CampaignRecipientStatusCounts {
  const sent = partial.sent ?? 0
  const pending = partial.pending ?? 0
  const sending = partial.sending ?? 0
  const failed = partial.failed ?? 0
  const cancelled = partial.cancelled ?? 0
  const notSent = pending + sending + failed + cancelled
  return {
    sent,
    pending,
    sending,
    failed,
    cancelled,
    notSent,
    total: sent + notSent
  }
}

type StatusAggRow = {
  _id: { campaign: unknown; status: string }
  count: number
}

function toCampaignObjectIds(campaignIds: string[]): mongoose.Types.ObjectId[] {
  const out: mongoose.Types.ObjectId[] = []
  const seen = new Set<string>()
  for (const raw of campaignIds) {
    const trimmed = String(raw ?? '').trim()
    if (!trimmed || !mongoose.isValidObjectId(trimmed) || seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(new mongoose.Types.ObjectId(trimmed))
  }
  return out
}

export async function countCampaignRecipientStatusesBatch(
  CampaignRecipient: CampaignRecipientModel,
  campaignIds: string[]
): Promise<Map<string, CampaignRecipientStatusCounts>> {
  const objectIds = toCampaignObjectIds(campaignIds)
  if (!objectIds.length) return new Map()

  const rows = await (CampaignRecipient as CampaignRecipientModel)
    .aggregate<StatusAggRow>([
      { $match: { campaign: { $in: objectIds } } },
      { $group: { _id: { campaign: '$campaign', status: '$status' }, count: { $sum: 1 } } }
    ])
    .exec()

  return buildRecipientStatusCountsMap(
    objectIds.map((id) => String(id)),
    rows.map((row) => ({
      campaignId: String(row._id.campaign),
      status: String(row._id.status ?? ''),
      count: Number(row.count) || 0
    }))
  )
}

export function buildRecipientStatusCountsMap(
  campaignIds: string[],
  rows: Array<{ campaignId: string; status: string; count: number }>
): Map<string, CampaignRecipientStatusCounts> {
  const map = new Map<string, CampaignRecipientStatusCounts>()
  for (const raw of campaignIds) {
    const trimmed = String(raw ?? '').trim()
    if (!trimmed || !mongoose.isValidObjectId(trimmed)) continue
    map.set(String(new mongoose.Types.ObjectId(trimmed)), emptyCounts())
  }

  const partial = new Map<
    string,
    { sent: number; pending: number; sending: number; failed: number; cancelled: number }
  >()

  for (const row of rows) {
    const campaignId = String(row.campaignId)
    const status = String(row.status ?? '')
    const count = Number(row.count) || 0
    const bucket = partial.get(campaignId) ?? {
      sent: 0,
      pending: 0,
      sending: 0,
      failed: 0,
      cancelled: 0
    }
    if (status === CAMPAIGN_RECIPIENT_STATUS_SENT) bucket.sent += count
    else if (status === CAMPAIGN_RECIPIENT_STATUS_PENDING) bucket.pending += count
    else if (status === CAMPAIGN_RECIPIENT_STATUS_SENDING) bucket.sending += count
    else if (status === CAMPAIGN_RECIPIENT_STATUS_FAILED) bucket.failed += count
    else if (status === CAMPAIGN_RECIPIENT_STATUS_CANCELLED) bucket.cancelled += count
    partial.set(campaignId, bucket)
  }

  for (const [campaignId, bucket] of partial) {
    map.set(campaignId, finalizeRecipientStatusCounts(bucket))
  }
  return map
}

export async function countCampaignRecipientStatuses(
  CampaignRecipient: CampaignRecipientModel,
  campaignId: string
): Promise<CampaignRecipientStatusCounts> {
  const trimmed = String(campaignId ?? '').trim()
  const key =
    trimmed && mongoose.isValidObjectId(trimmed)
      ? String(new mongoose.Types.ObjectId(trimmed))
      : trimmed
  const map = await countCampaignRecipientStatusesBatch(CampaignRecipient, [trimmed])
  return map.get(key) ?? emptyCounts()
}
