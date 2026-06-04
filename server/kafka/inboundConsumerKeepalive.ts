import { logger } from '../utils/logger'

/** Subscribe/resubscribe targeted a topic that does not exist on the cluster yet. */
export function isKafkaMissingTopicPartitionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return (
    /does not host this topic-partition/i.test(msg) ||
    /unknown topic or partition/i.test(msg) ||
    /unknown_topic_or_partition/i.test(msg)
  )
}

/** Broker evicted this consumer or the group is rebalancing — not a handler/data bug. */
export function isKafkaConsumerGroupCoordinationError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return (
    /coordinator is not aware of this member/i.test(msg) ||
    /the group is rebalancing/i.test(msg) ||
    /rebalance in progress/i.test(msg) ||
    /unknown member/i.test(msg) ||
    /illegal generation/i.test(msg)
  )
}

/**
 * Kafka only heartbeats after eachMessage returns unless we call heartbeat() manually.
 * Long Mongo sync chunks must tick heartbeats during processing or the broker drops the member.
 */
export function runInboundConsumerHeartbeatKeepalive(heartbeat: () => Promise<void>): () => void {
  const intervalMs = Math.max(1_000, parseKeepaliveIntervalMs())
  let stopped = false

  const tick = () => {
    if (stopped) return
    void heartbeat().catch((err) => {
      if (isKafkaConsumerGroupCoordinationError(err)) return
      logger.warn('Kafka inbound heartbeat keepalive failed', {
        err: err instanceof Error ? err.message : String(err)
      })
    })
  }

  const timer = setInterval(tick, intervalMs)
  tick()

  return () => {
    stopped = true
    clearInterval(timer)
  }
}

function parseKeepaliveIntervalMs(): number {
  const raw = Number(process.env.KAFKA_CONSUMER_HEARTBEAT_INTERVAL_MS)
  if (Number.isFinite(raw) && raw >= 1_000) return Math.floor(raw)
  return 3_000
}
