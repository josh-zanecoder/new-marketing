import type { CampaignSendCompletedKafkaParams } from './publishCampaignSendCompleted'
import { publishCampaignSendCompletedToKafka } from './publishCampaignSendCompleted'

export type NotifyCampaignSendCompletedParams = CampaignSendCompletedKafkaParams

/**
 * Optional post-completion CRM notify. Campaign send runs on BullMQ, not Kafka.
 * Failures are logged and never affect send status.
 *
 * Set `CAMPAIGN_SEND_KAFKA_NOTIFY=false` to disable entirely.
 */
export async function notifyCampaignSendCompleted(
  params: NotifyCampaignSendCompletedParams
): Promise<void> {
  if (process.env.CAMPAIGN_SEND_KAFKA_NOTIFY === 'false') return
  try {
    await publishCampaignSendCompletedToKafka(params)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[CampaignSend] optional Kafka notify failed', {
      campaignId: params.campaignId,
      message: msg
    })
  }
}
