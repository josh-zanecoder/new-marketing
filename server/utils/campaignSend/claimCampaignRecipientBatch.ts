import type {
  CampaignRecipientLean,
  CampaignRecipientModel
} from '../../types/tenant/campaignRecipient.model'
import {
  CAMPAIGN_RECIPIENT_STATUS_FAILED,
  CAMPAIGN_RECIPIENT_STATUS_PENDING,
  CAMPAIGN_RECIPIENT_STATUS_SENDING
} from './constants'

const CLAIMABLE_STATUSES = [
  CAMPAIGN_RECIPIENT_STATUS_PENDING,
  CAMPAIGN_RECIPIENT_STATUS_FAILED
] as const

/**
 * Atomically marks up to `limit` pending/failed rows as `sending`.
 * Uses one find (full docs) + one updateMany; skips a third re-fetch when all rows claim cleanly.
 */
export async function claimCampaignRecipientBatch(
  CampaignRecipient: CampaignRecipientModel,
  campaignId: string,
  limit: number
): Promise<CampaignRecipientLean[]> {
  const candidates = await CampaignRecipient.find({
    campaign: campaignId,
    status: { $in: CLAIMABLE_STATUSES }
  })
    .sort({ _id: 1 })
    .limit(limit)
    .lean<CampaignRecipientLean[]>()

  if (candidates.length === 0) return []

  const ids = candidates.map((c) => c._id)
  const claimResult = await CampaignRecipient.updateMany(
    {
      _id: { $in: ids },
      campaign: campaignId,
      status: { $in: CLAIMABLE_STATUSES }
    },
    {
      $set: { status: CAMPAIGN_RECIPIENT_STATUS_SENDING },
      $unset: { error: 1, brevoMessageId: 1 }
    }
  )

  const modified = claimResult.modifiedCount ?? 0
  if (modified === candidates.length) {
    return candidates.map((row) => ({
      ...row,
      status: CAMPAIGN_RECIPIENT_STATUS_SENDING,
      error: undefined,
      brevoMessageId: undefined
    }))
  }

  if (modified === 0) return []

  return CampaignRecipient.find({
    _id: { $in: ids },
    campaign: campaignId,
    status: CAMPAIGN_RECIPIENT_STATUS_SENDING
  })
    .sort({ _id: 1 })
    .lean<CampaignRecipientLean[]>()
}
