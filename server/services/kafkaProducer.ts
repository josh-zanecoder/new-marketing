import { Kafka, type Admin, type KafkaConfig, type Producer, type SASLOptions } from 'kafkajs'
import type { MarketingKafkaEnvelope } from '../types/marketingKafkaEvent'
import { getRegistryConnection } from '../lib/mongoose'

let producer: Producer | null = null
let connectPromise: Promise<Producer | null> | null = null
let admin: Admin | null = null
let adminConnectPromise: Promise<Admin | null> | null = null
const tenantTopicCache = new Map<string, string>()

type KafkaRuntime = {
  kafkaBrokers: string
  kafkaClientId: string
  kafkaTopicEvents: string
  kafkaUsername: string
  kafkaPassword: string
  kafkaSaClientEmail: string
  kafkaSaPrivateKey: string
  kafkaSaProjectId: string
  kafkaSsl: boolean
  kafkaSaslMechanism: string
}

function resolveKafkaRuntime(): KafkaRuntime {
  try {
    const c = useRuntimeConfig()
    return {
      kafkaBrokers: String(c.kafkaBrokers || process.env.KAFKA_BROKERS || ''),
      kafkaClientId: String(c.kafkaClientId || process.env.KAFKA_CLIENT_ID || 'new-marketing'),
      kafkaTopicEvents: String(
        c.kafkaTopicEvents || process.env.KAFKA_TOPIC_MARKETING_EVENTS || 'marketing.events'
      ),
      kafkaUsername: String(c.kafkaUsername || process.env.KAFKA_USERNAME || ''),
      kafkaPassword: String(c.kafkaPassword || process.env.KAFKA_PASSWORD || ''),
      kafkaSaClientEmail: String(c.kafkaSaClientEmail || process.env.KAFKA_SA_CLIENT_EMAIL || ''),
      kafkaSaPrivateKey: String(c.kafkaSaPrivateKey || process.env.KAFKA_SA_PRIVATE_KEY || ''),
      kafkaSaProjectId: String(c.kafkaSaProjectId || process.env.KAFKA_SA_PROJECT_ID || ''),
      kafkaSsl: c.kafkaSsl !== false && String(c.kafkaSsl) !== 'false',
      kafkaSaslMechanism: String(c.kafkaSaslMechanism || process.env.KAFKA_SASL_MECHANISM || 'plain')
    }
  } catch {
    return {
      kafkaBrokers: process.env.KAFKA_BROKERS || '',
      kafkaClientId: process.env.KAFKA_CLIENT_ID || 'new-marketing',
      kafkaTopicEvents: process.env.KAFKA_TOPIC_MARKETING_EVENTS || 'marketing.events',
      kafkaUsername: process.env.KAFKA_USERNAME || '',
      kafkaPassword: process.env.KAFKA_PASSWORD || '',
      kafkaSaClientEmail: process.env.KAFKA_SA_CLIENT_EMAIL || '',
      kafkaSaPrivateKey: process.env.KAFKA_SA_PRIVATE_KEY || '',
      kafkaSaProjectId: process.env.KAFKA_SA_PROJECT_ID || '',
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

function toTopicSuffix(value: string): string {
  const s = value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '_')
  return s || 'tenant'
}

export function getTenantEventTopic(tenantDbName: string): string {
  const base = resolveKafkaRuntime().kafkaTopicEvents || 'marketing.events'
  return `${base}.${toTopicSuffix(tenantDbName)}`
}

async function getTenantEventTopicByDbName(tenantDbName: string): Promise<string> {
  const cached = tenantTopicCache.get(tenantDbName)
  if (cached) return cached
  let topic = getTenantEventTopic(tenantDbName)
  try {
    const registry = await getRegistryConnection()
    const row = await registry
      .collection('clients')
      .findOne({ dbName: tenantDbName })
      .then((d) => d as { name?: string } | null)
    const tenantName = typeof row?.name === 'string' ? row.name.trim() : ''
    if (tenantName) topic = getTenantEventTopic(tenantName)
  } catch {}
  tenantTopicCache.set(tenantDbName, topic)
  return topic
}

function hasSaslCredentials(cfg: KafkaRuntime): boolean {
  return buildSaslCredentials(cfg) !== null
}

function buildSaslCredentials(cfg: KafkaRuntime): { username: string; password: string } | null {
  const email = cfg.kafkaSaClientEmail.trim()
  const key = cfg.kafkaSaPrivateKey.trim()
  if (email && key) {
    const privateKey = key.replace(/\\n/g, '\n')
    const projectId = cfg.kafkaSaProjectId.trim() || 'default'
    const saJson = JSON.stringify({
      type: 'service_account',
      project_id: projectId,
      private_key_id: '',
      private_key: privateKey,
      client_email: email,
      client_id: '',
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: ''
    })
    const password = Buffer.from(saJson, 'utf8').toString('base64')
    return { username: email, password }
  }
  if (cfg.kafkaUsername && cfg.kafkaPassword) {
    return { username: cfg.kafkaUsername, password: cfg.kafkaPassword }
  }
  return null
}

function isLocalBroker(cfg: KafkaRuntime): boolean {
  const brokers = parseBrokers(cfg.kafkaBrokers)
  return brokers.some((b) => b.includes('127.0.0.1') || b.includes('localhost'))
}

function buildSasl(cfg: KafkaRuntime): SASLOptions | undefined {
  if (isLocalBroker(cfg)) return undefined
  const creds = buildSaslCredentials(cfg)
  if (!creds) return undefined
  const { username, password } = creds
  const mechanism = cfg.kafkaSaslMechanism
  if (mechanism === 'plain') return { mechanism: 'plain', username, password }
  if (mechanism === 'scram-sha-256') return { mechanism: 'scram-sha-256', username, password }
  return { mechanism: 'scram-sha-512', username, password }
}

/** Managed Kafka requires TLS when using SASL; do not tie SASL to kafkaSsl only. */
function useTlsForRemote(cfg: KafkaRuntime): boolean {
  if (isLocalBroker(cfg)) return false
  if (hasSaslCredentials(cfg)) return true
  return cfg.kafkaSsl !== false && String(cfg.kafkaSsl) !== 'false'
}

async function getProducer(): Promise<Producer | null> {
  const cfg = resolveKafkaRuntime()
  const brokers = parseBrokers(cfg.kafkaBrokers)
  if (brokers.length === 0) {
    console.log('[Kafka] No brokers configured, skip')
    return null
  }
  if (producer) return producer
  if (connectPromise) return connectPromise
  const sasl = buildSasl(cfg)
  const useSsl = useTlsForRemote(cfg)
  connectPromise = (async () => {
    const kafkaConfig: KafkaConfig = {
      clientId: cfg.kafkaClientId,
      brokers,
      ssl: useSsl,
      ...(sasl && { sasl })
    }
    const kafka = new Kafka(kafkaConfig)
    const p = kafka.producer({ allowAutoTopicCreation: true })
    await p.connect()
    producer = p
    console.log('[Kafka] Producer connected to', brokers.join(', '))
    return p
  })().finally(() => {
    connectPromise = null
  })
  return connectPromise
}

async function getAdmin(): Promise<Admin | null> {
  const cfg = resolveKafkaRuntime()
  const brokers = parseBrokers(cfg.kafkaBrokers)
  if (brokers.length === 0) return null
  if (admin) return admin
  if (adminConnectPromise) return adminConnectPromise
  const sasl = buildSasl(cfg)
  const useSsl = useTlsForRemote(cfg)
  adminConnectPromise = (async () => {
    const kafkaConfig: KafkaConfig = {
      clientId: `${cfg.kafkaClientId}-admin`,
      brokers,
      ssl: useSsl,
      ...(sasl && { sasl })
    }
    const kafka = new Kafka(kafkaConfig)
    const a = kafka.admin()
    await a.connect()
    admin = a
    return a
  })().finally(() => {
    adminConnectPromise = null
  })
  return adminConnectPromise
}

function topicReplicationFactor(): number {
  const raw = (process.env.KAFKA_TOPIC_REPLICATION_FACTOR || '').trim()
  if (raw) {
    const n = parseInt(raw, 10)
    return Number.isFinite(n) && n > 0 ? n : 1
  }
  const brokers = parseBrokers(resolveKafkaRuntime().kafkaBrokers)
  if (brokers.some((b) => b.includes('managedkafka'))) return 3
  return 1
}

export async function ensureTenantEventTopic(tenantNameOrDbName: string): Promise<string | null> {
  if (!isKafkaConfigured()) {
    console.warn('[Kafka] KAFKA_BROKERS is empty; skip tenant topic creation')
    return null
  }
  const topic = getTenantEventTopic(tenantNameOrDbName)
  const a = await getAdmin()
  if (!a) return null
  const replicationFactor = topicReplicationFactor()
  console.log('[Kafka] ensure topic', topic, 'replicationFactor', replicationFactor)
  await a.createTopics({
    waitForLeaders: true,
    topics: [{ topic, numPartitions: 1, replicationFactor }]
  })
  return topic
}

export async function publishMarketingEnvelope(envelope: MarketingKafkaEnvelope): Promise<void> {
  const p = await getProducer()
  if (!p) return
  const topic = await getTenantEventTopicByDbName(envelope.tenantDbName)
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
    console.log('[Kafka] campaign.send.completed published', { campaignId: params.campaignId, tenantDbName: params.tenantDbName })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Kafka] publish campaign.send.completed failed:', msg)
  }
}
