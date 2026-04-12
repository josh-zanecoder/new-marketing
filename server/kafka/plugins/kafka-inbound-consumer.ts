import { logger } from '../../utils/logger'

function isInboundConsumerDisabled(): boolean {
  return (
    process.env.KAFKA_INBOUND_CONSUMER_DISABLED === 'true' ||
    process.env.KAFKA_CRM_CONSUMER_DISABLED === 'true'
  )
}

export default defineNitroPlugin(() => {
  if (isInboundConsumerDisabled()) return
  import('../kafkaProducer')
    .then(({ startInboundEventsConsumer }) => startInboundEventsConsumer())
    .catch((err) => {
      logger.error(
        'Failed to start Kafka inbound consumer',
        err instanceof Error ? err.message : String(err)
      )
    })
})
