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

function inboundTopicSignalMs(): number {
  const raw = Number(process.env.KAFKA_INBOUND_TOPIC_SIGNAL_MS)
  if (raw === 0) return 0
  return Number.isFinite(raw) && raw >= 10_000 ? Math.floor(raw) : 30_000
}

export default defineNitroPlugin((nitroApp) => {
  if (isInboundConsumerDisabled()) {
    logger.info('Kafka inbound consumer disabled on this instance', {
      KAFKA_INBOUND_CONSUMER_DISABLED: process.env.KAFKA_INBOUND_CONSUMER_DISABLED ?? '',
      KAFKA_CRM_CONSUMER_DISABLED: process.env.KAFKA_CRM_CONSUMER_DISABLED ?? ''
    })
    return
  }

  let starting = false
  let refreshTimer: ReturnType<typeof setInterval> | null = null
  let shutdownHookRegistered = false

  async function shutdownInboundConsumer(reason: string): Promise<void> {
    if (refreshTimer) {
      clearInterval(refreshTimer)
      refreshTimer = null
    }
    const { shutdownInboundEventsConsumer } = await import('../kafkaProducer')
    await shutdownInboundEventsConsumer(reason)
  }

  function registerShutdownHooks(): void {
    if (shutdownHookRegistered) return
    shutdownHookRegistered = true
    nitroApp.hooks.hook('close', async () => {
      await shutdownInboundConsumer('nitro-close')
    })
    process.once('SIGTERM', () => {
      void shutdownInboundConsumer('SIGTERM')
    })
    process.once('SIGINT', () => {
      void shutdownInboundConsumer('SIGINT')
    })
  }

  async function tryStart(): Promise<void> {
    if (starting) return
    starting = true
    try {
      const { startInboundEventsConsumer, isInboundConsumerShuttingDown } = await import(
        '../kafkaProducer'
      )
      if (isInboundConsumerShuttingDown()) return
      await startInboundEventsConsumer()
    } catch (err) {
      const { isInboundConsumerShuttingDown } = await import('../kafkaProducer')
      if (isInboundConsumerShuttingDown()) return
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

  registerShutdownHooks()
  void tryStart()

  const refreshMs = inboundTopicRefreshMs()
  if (refreshMs > 0) {
    logger.info('Kafka inbound topic refresh scheduler enabled', { refreshMs })
    refreshTimer = setInterval(() => {
      import('../kafkaProducer')
        .then(({ refreshInboundEventsConsumerTopicsIfChanged, isInboundConsumerShuttingDown }) => {
          if (isInboundConsumerShuttingDown()) return false
          return refreshInboundEventsConsumerTopicsIfChanged({
            reason: 'scheduled-poll',
            source: 'poll'
          })
        })
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

  const signalMs = inboundTopicSignalMs()
  if (signalMs > 0) {
    logger.info('Kafka inbound topic refresh signal checker enabled', { signalMs })
    setInterval(() => {
      import('../kafkaProducer')
        .then(({ processInboundTopicRefreshSignal, isInboundConsumerShuttingDown }) => {
          if (isInboundConsumerShuttingDown()) return
          return processInboundTopicRefreshSignal()
        })
        .catch((err) => {
          logger.warn('Kafka inbound topic refresh signal tick failed', {
            err: err instanceof Error ? err.message : String(err)
          })
        })
    }, signalMs)
  }
})
