import { logger } from '../../utils/logger'

function isInboundConsumerDisabled(): boolean {
  return (
    process.env.KAFKA_INBOUND_CONSUMER_DISABLED === 'true' ||
    process.env.KAFKA_CRM_CONSUMER_DISABLED === 'true'
  )
}

function inboundConsumerStartRetryMs(): number {
  const raw = Number(process.env.KAFKA_INBOUND_CONSUMER_START_RETRY_MS)
  return Number.isFinite(raw) && raw >= 5_000 ? Math.floor(raw) : 30_000
}

function inboundTopicRefreshMs(): number {
  const raw = Number(process.env.KAFKA_INBOUND_TOPIC_REFRESH_MS)
  if (raw === 0) return 0
  return Number.isFinite(raw) && raw >= 15_000 ? Math.floor(raw) : 60_000
}

export default defineNitroPlugin(() => {
  if (isInboundConsumerDisabled()) {
    logger.info('Kafka inbound consumer disabled on this instance', {
      KAFKA_INBOUND_CONSUMER_DISABLED: process.env.KAFKA_INBOUND_CONSUMER_DISABLED ?? '',
      KAFKA_CRM_CONSUMER_DISABLED: process.env.KAFKA_CRM_CONSUMER_DISABLED ?? ''
    })
    return
  }

  let starting = false

  async function tryStart(): Promise<void> {
    if (starting) return
    starting = true
    try {
      const { startInboundEventsConsumer } = await import('../kafkaProducer')
      await startInboundEventsConsumer()
    } catch (err) {
      const retryMs = inboundConsumerStartRetryMs()
      logger.error('Failed to start Kafka inbound consumer; will retry', {
        err: err instanceof Error ? err.message : String(err),
        retryMs
      })
      setTimeout(() => {
        void tryStart()
      }, retryMs)
    } finally {
      starting = false
    }
  }

  void tryStart()

  const refreshMs = inboundTopicRefreshMs()
  if (refreshMs > 0) {
    logger.info('Kafka inbound topic refresh scheduler enabled', { refreshMs })
    setInterval(() => {
      import('../kafkaProducer')
        .then(({ refreshInboundEventsConsumerTopicsIfChanged }) =>
          refreshInboundEventsConsumerTopicsIfChanged()
        )
        .catch((err) => {
          logger.warn('Kafka inbound topic refresh tick failed', {
            err: err instanceof Error ? err.message : String(err)
          })
        })
    }, refreshMs)
  } else {
    logger.info('Kafka inbound topic refresh scheduler disabled', {
      KAFKA_INBOUND_TOPIC_REFRESH_MS: process.env.KAFKA_INBOUND_TOPIC_REFRESH_MS ?? ''
    })
  }
})
