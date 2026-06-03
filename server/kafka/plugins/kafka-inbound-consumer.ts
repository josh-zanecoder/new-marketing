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

export default defineNitroPlugin(() => {
  if (isInboundConsumerDisabled()) return

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
})
