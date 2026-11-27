import type { MarketingKafkaEnvelope } from './marketingKafkaEvent'
import { isKafkaConfigured, publishMarketingEnvelope } from './kafkaProducer'
import { logger } from '../utils/logger'

export type RatesheetUnsubscribedKafkaParams = {
  tenantDbName: string
  tenantId?: string
  email: string
  reason?: string
  source?: string
}

/**
 * Notify CRM that a Marketing unsubscribe should also opt the email out of ratesheets.
 * Best-effort: campaign / preference flows do not depend on Kafka.
 */
export async function publishRatesheetUnsubscribedToKafka(
  params: RatesheetUnsubscribedKafkaParams
): Promise<void> {
  const email = String(params.email || '')
    .trim()
    .toLowerCase()
  const tenantDbName = String(params.tenantDbName || '').trim()
  if (!email || !email.includes('@') || !tenantDbName) {
    logger.debug('ratesheet.unsubscribed skipped (invalid email or tenantDbName)', {
      tenantDbName,
      hasEmail: Boolean(email)
    })
    return
  }

  if (!isKafkaConfigured()) {
    logger.debug('ratesheet.unsubscribed skipped (Kafka not configured)', {
      tenantDbName,
      email
    })
    return
  }

  const envelope: MarketingKafkaEnvelope = {
    eventType: 'ratesheet.unsubscribed',
    occurredAt: new Date().toISOString(),
    tenantDbName,
    ...(params.tenantId?.trim() ? { tenantId: params.tenantId.trim() } : {}),
    payload: {
      email,
      reason: params.reason?.trim() || 'marketing_unsubscribe',
      source: params.source?.trim() || 'new-marketing'
    }
  }

  try {
    await publishMarketingEnvelope(envelope)
    logger.info('ratesheet.unsubscribed published', {
      tenantDbName,
      tenantId: params.tenantId || null,
      email,
      reason: envelope.payload.reason
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error('publish ratesheet.unsubscribed failed', msg)
  }
}
