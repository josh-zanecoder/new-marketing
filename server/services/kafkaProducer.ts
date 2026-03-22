import { Kafka, type Producer, type SASLOptions } from 'kafkajs'
import type { MarketingKafkaEnvelope } from '../types/marketingKafkaEvent'

let producer: Producer | null = null
let connectPromise: Promise<Producer | null> | null = null

type KafkaRuntime = {
  kafkaBrokers: string
  kafkaClientId: string
  kafkaTopicEvents: string
  kafkaUsername: string
  kafkaPassword: string
  kafkaSsl: boolean
  kafkaSaslMechanism: string
}

function resolveKafkaRuntime(): KafkaRuntime {
  try {
    const c = useRuntimeConfig()
    return {
      kafkaBrokers: String(c.kafkaBrokers || ''),
      kafkaClientId: String(c.kafkaClientId || 'new-marketing'),
      kafkaTopicEvents: String(c.kafkaTopicEvents || 'marketing.events'),
      kafkaUsername: String(c.kafkaUsername || ''),
      kafkaPassword: String(c.kafkaPassword || ''),
      kafkaSsl: c.kafkaSsl !== false && String(c.kafkaSsl) !== 'false',
      kafkaSaslMechanism: String(c.kafkaSaslMechanism || 'plain')
    }
  } catch {
    return {
      kafkaBrokers: process.env.KAFKA_BROKERS || '',
      kafkaClientId: process.env.KAFKA_CLIENT_ID || 'new-marketing',
      kafkaTopicEvents: process.env.KAFKA_TOPIC_MARKETING_EVENTS || 'marketing.events',
      kafkaUsername: process.env.KAFKA_USERNAME || '',
      kafkaPassword: process.env.KAFKA_PASSWORD || '',
      kafkaSsl: process.env.KAFKA_SSL !== 'false',
      kafkaSaslMechanism: process.env.KAFKA_SASL_MECHANISM || 'plain'
    }
  }
}

function parseBrokers(raw: string): string[] {
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

/** True when `KAFKA_BROKERS` resolves to at least one broker (producer will attempt connect). */
export function isKafkaConfigured(): boolean {
  return parseBrokers(resolveKafkaRuntime().kafkaBrokers).length > 0
}

function buildSasl(username: string, password: string, mechanism: string): SASLOptions | undefined {
  if (!username || !password) return undefined
  if (mechanism === 'plain') return { mechanism: 'plain', username, password }
  if (mechanism === 'scram-sha-256') return { mechanism: 'scram-sha-256', username, password }
  return { mechanism: 'scram-sha-512', username, password }
}

async function getProducer(): Promise<Producer | null> {
  const cfg = resolveKafkaRuntime()
  const brokers = parseBrokers(cfg.kafkaBrokers)
  if (brokers.length === 0) return null
  if (producer) return producer
  if (connectPromise) return connectPromise
  connectPromise = (async () => {
    const kafka = new Kafka({
      clientId: cfg.kafkaClientId,
      brokers,
      ssl: cfg.kafkaSsl,
      sasl: buildSasl(cfg.kafkaUsername, cfg.kafkaPassword, cfg.kafkaSaslMechanism)
    })
    const p = kafka.producer({ allowAutoTopicCreation: false })
    await p.connect()
    producer = p
    return p
  })().finally(() => {
    connectPromise = null
  })
  return connectPromise
}

export async function publishMarketingEnvelope(envelope: MarketingKafkaEnvelope): Promise<void> {
  const cfg = resolveKafkaRuntime()
  const p = await getProducer()
  if (!p) return
  const topic = cfg.kafkaTopicEvents
  await p.send({
    topic,
    messages: [{ key: envelope.tenantDbName, value: JSON.stringify(envelope) }]
  })
}

export async function publishCampaignSendCompleted(params: {
  tenantDbName: string
  campaignId: string
  campaignStatus: string
  sent: number
  failed: number
  total: number
}): Promise<void> {
  const envelope: MarketingKafkaEnvelope = {
    eventType: 'campaign.send.completed',
    occurredAt: new Date().toISOString(),
    tenantDbName: params.tenantDbName,
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Kafka] publish campaign.send.completed failed:', msg)
  }
}
