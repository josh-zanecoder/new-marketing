import type {
  CampaignRecipientLean,
  CampaignRecipientModel
} from '../../types/tenant/campaignRecipient.model'
import {
  CAMPAIGN_RECIPIENT_STATUS_FAILED,
  CAMPAIGN_RECIPIENT_STATUS_PENDING,
  CAMPAIGN_RECIPIENT_STATUS_SENDING
} from './constants'

/**
 * Atomically marks up to `limit` pending/failed rows as `sending` (ratesheet delivery-ledger pattern).
 * Returns only rows this worker successfully claimed.
 */
export async function claimCampaignRecipientBatch(
  CampaignRecipient: CampaignRecipientModel,
  campaignId: string,
  limit: number
): Promise<CampaignRecipientLean[]> {
  const candidates = await CampaignRecipient.find({
    campaign: campaignId,
    status: { $in: [CAMPAIGN_RECIPIENT_STATUS_PENDING, CAMPAIGN_RECIPIENT_STATUS_FAILED] }
  })
    .sort({ _id: 1 })
    .limit(limit)
    .select('_id')
    .lean<{ _id: CampaignRecipientLean['_id'] }[]>()

  if (candidates.length === 0) return []

  const ids = candidates.map((c) => c._id)
  await CampaignRecipient.updateMany(
    {
      _id: { $in: ids },
      campaign: campaignId,
      status: { $in: [CAMPAIGN_RECIPIENT_STATUS_PENDING, CAMPAIGN_RECIPIENT_STATUS_FAILED] }
    },
    {
      $set: { status: CAMPAIGN_RECIPIENT_STATUS_SENDING },
      $unset: { error: 1, brevoMessageId: 1 }
    }
  )

  return CampaignRecipient.find({
    _id: { $in: ids },
    campaign: campaignId,
    status: CAMPAIGN_RECIPIENT_STATUS_SENDING
  })
    .sort({ _id: 1 })
    .lean<CampaignRecipientLean[]>()
}
