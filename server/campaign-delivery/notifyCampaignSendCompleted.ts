import type { CampaignSendCompletedKafkaParams } from '../kafka/publishCampaignSendCompleted'

export type NotifyCampaignSendCompletedParams = CampaignSendCompletedKafkaParams

/**
 * Campaign send + schedule run on BullMQ (Redis), not Kafka.
 * This hook is an optional post-completion notify to CRM — failures never affect send status.
 *
 * Set `CAMPAIGN_SEND_KAFKA_NOTIFY=false` to disable entirely.
 */
export async function notifyCampaignSendCompleted(
  params: NotifyCampaignSendCompletedParams
): Promise<void> {
  if (process.env.CAMPAIGN_SEND_KAFKA_NOTIFY === 'false') return
  try {
    const { publishCampaignSendCompletedToKafka } = await import(
      '../kafka/publishCampaignSendCompleted'
    )
    await publishCampaignSendCompletedToKafka(params)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[CampaignDelivery] optional Kafka notify failed', {
      campaignId: params.campaignId,
      message: msg
    })
  }
}
