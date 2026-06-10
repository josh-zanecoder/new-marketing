import type { CampaignRecipientModel } from '../../types/tenant/campaignRecipient.model'
import {
  CAMPAIGN_RECIPIENT_STATUS_FAILED,
  CAMPAIGN_RECIPIENT_STATUS_PENDING,
  CAMPAIGN_RECIPIENT_STATUS_SENDING,
  CAMPAIGN_RECIPIENT_STATUS_SENT
} from './constants'

export type RecipientStatusCounts = {
  pending: number
  sent: number
  failed: number
}

const QUEUED_STATUSES = [
  CAMPAIGN_RECIPIENT_STATUS_PENDING,
  CAMPAIGN_RECIPIENT_STATUS_SENDING
] as const

/**
 * One aggregation instead of three countDocuments (used by status polling and batch worker).
 */
export async function countRecipientStatuses(
  CampaignRecipient: CampaignRecipientModel,
  campaignId: string
): Promise<RecipientStatusCounts> {
  const rows = await CampaignRecipient.aggregate<{ _id: string; count: number }>([
    { $match: { campaign: campaignId } },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ])

  let pending = 0
  let sent = 0
  let failed = 0

  for (const row of rows) {
    const status = String(row._id ?? '')
    const count = Number(row.count) || 0
    if (status === CAMPAIGN_RECIPIENT_STATUS_SENT) sent = count
    else if (status === CAMPAIGN_RECIPIENT_STATUS_FAILED) failed = count
    else if (QUEUED_STATUSES.includes(status as (typeof QUEUED_STATUSES)[number])) pending += count
  }

  return { pending, sent, failed }
}

/** Recipients still eligible for the active send run (includes retryable `failed`). */
export async function countOutstandingSendWork(
  CampaignRecipient: CampaignRecipientModel,
  campaignId: string
): Promise<number> {
  return CampaignRecipient.countDocuments({
    campaign: campaignId,
    status: {
      $in: [
        CAMPAIGN_RECIPIENT_STATUS_PENDING,
        CAMPAIGN_RECIPIENT_STATUS_SENDING,
        CAMPAIGN_RECIPIENT_STATUS_FAILED
      ]
    }
  })
}
