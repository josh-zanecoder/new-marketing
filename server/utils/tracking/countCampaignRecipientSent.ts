import type { CampaignRecipientModel } from '@server/types/tenant/campaignRecipient.model'
import { CAMPAIGN_RECIPIENT_STATUS_SENT } from '@server/utils/campaignSend/constants'

/**
 * Count CampaignRecipient rows with status `sent` for a campaign.
 * Uses string campaign id (same as recipient report) so Mongoose schema casting
 * matches ObjectId and legacy string `campaign` values.
 */
export async function countCampaignRecipientSent(
  CampaignRecipient: CampaignRecipientModel,
  campaignId: string
): Promise<number> {
  const id = String(campaignId ?? '').trim()
  if (!id) return 0

  const count = await CampaignRecipient.countDocuments({
    campaign: id,
    status: CAMPAIGN_RECIPIENT_STATUS_SENT
  })
  return typeof count === 'number' && Number.isFinite(count) ? count : 0
}
