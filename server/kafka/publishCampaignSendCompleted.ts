import type { MarketingKafkaEnvelope } from './marketingKafkaEvent'
import { isKafkaConfigured, publishMarketingEnvelope } from './kafkaProducer'
import { logger } from '../utils/logger'

export type CampaignSendCompletedKafkaParams = {
  tenantDbName: string
  tenantId?: string
  campaignId: string
  campaignStatus: string
  sent: number
  failed: number
  total: number
}

/**
 * Optional outbound CRM notification only. Campaign send does not depend on Kafka.
 */
export async function publishCampaignSendCompletedToKafka(
  params: CampaignSendCompletedKafkaParams
): Promise<void> {
  if (!isKafkaConfigured()) {
    logger.debug('campaign.send.completed skipped (Kafka not configured)', {
      campaignId: params.campaignId
    })
    return
  }

  const envelope: MarketingKafkaEnvelope = {
    eventType: 'campaign.send.completed',
    occurredAt: new Date().toISOString(),
    tenantDbName: params.tenantDbName,
    tenantId: params.tenantId,
    payload: {
      campaignId: params.campaignId,
      campaignStatus: params.campaignStatus,
      sent: params.sent,
      failed: params.failed,
      total: params.total
    }
  }
  try {
    await publishMarketingEnvelope(envelope)
    logger.info('campaign.send.completed published', {
      campaignId: params.campaignId,
      tenantDbName: params.tenantDbName
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error('publish campaign.send.completed failed', msg)
  }
}
