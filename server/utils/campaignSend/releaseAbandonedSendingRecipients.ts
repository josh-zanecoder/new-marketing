import type { CampaignRecipientModel } from '../../types/tenant/campaignRecipient.model'
import {
  CAMPAIGN_RECIPIENT_STATUS_PENDING,
  CAMPAIGN_RECIPIENT_STATUS_SENDING,
  CAMPAIGN_SEND_RECONCILE_ACK_SENDING_MS_DEFAULT
} from './constants'

export function abandonedSendingCutoff(now: number = Date.now()): Date {
  const ms = Math.max(
    60_000,
    Number(
      process.env.CAMPAIGN_SEND_RECONCILE_ACK_SENDING_MS ??
        CAMPAIGN_SEND_RECONCILE_ACK_SENDING_MS_DEFAULT
    )
  )
  return new Date(now - ms)
}

/**
 * Paused/stopped campaigns only: a batch whose worker died leaves rows in `sending`
 * forever, and those rows make the send look active, blocking Resume / Send again.
 * Rows touched within the cutoff are left alone because a worker may still be finishing them.
 */
export async function releaseAbandonedSendingRecipients(
  CampaignRecipient: CampaignRecipientModel,
  campaignId: string,
  now: number = Date.now()
): Promise<number> {
  const res = await CampaignRecipient.updateMany(
    {
      campaign: campaignId,
      status: CAMPAIGN_RECIPIENT_STATUS_SENDING,
      updatedAt: { $lt: abandonedSendingCutoff(now) }
    },
    { $set: { status: CAMPAIGN_RECIPIENT_STATUS_PENDING }, $unset: { error: 1 } }
  )
  return res.modifiedCount ?? 0
}
