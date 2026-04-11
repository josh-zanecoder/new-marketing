import {
  Kafka,
  Partitioners,
  type Admin,
  type Consumer,
  type KafkaConfig,
  type Producer,
  type SASLOptions
} from 'kafkajs'
import type { MarketingKafkaEnvelope } from '../types/marketingKafkaEvent'
import { getRegistryConnection } from '../lib/mongoose'
import { logger } from '../utils/logger'
import {
  CONTACT_EVENT_TYPES,
  namesFromContactPayload,
  parseContactDeletedEventEnvelope,
  parseContactEventEnvelope
} from '../schemas/events/contactEvents'
import { formatContactFullName } from '../utils/contactPersonName'
import {
  EMAIL_TEMPLATE_EVENT_TYPES,
  parseEmailTemplateCreatedEventEnvelope,
  parseEmailTemplateDeletedEventEnvelope,
  parseEmailTemplateUpdatedEventEnvelope
} from '../schemas/events/emailTemplateEvents'
import {
  createContactFromCreatedEvent,
  softDeleteContactFromDeletedEvent,
  updateContactFromUpdatedEvent,
  upsertContactsFromSyncSnapshot
} from '../kafka/handlers/inboundContacts'
import {
  deleteMarketingEmailTemplateFromDeletedEvent,
  saveMarketingEmailTemplateFromCreatedEvent,
  saveMarketingEmailTemplateFromUpdatedEvent
} from '../kafka/handlers/inboundEmailTemplates'

// --- Runtime / client config -------------------------------------------------
const SYNC_REQUESTED_EVENT_TYPE = 'marketing.sync.requested' as const

type MarketingSyncRequestedEnvelope = {
  eventType: typeof SYNC_REQUESTED_EVENT_TYPE
  occurredAt: string
  dBname: string
  tenantId: string
  payload: {
    tenantId: string
    dBname: string
    syncType: 'login_reconcile' | string
    syncId?: string
    chunkIndex?: number
    chunkCount?: number
    tenantWideContacts: boolean
    ownerEmails?: string[]
    contacts?: Array<{
      externalId: string
      firstName?: string
      lastName?: string
      name?: string
      email: string
      phone?: string
      company?: string
      address?: Record<string, unknown>
      contactType?: string
      channel?: string
      metadata?: Record<string, unknown>
    }>
    requestedByUserId?: string
    requestedByEmail?: string
  }
}

function parseMarketingSyncRequestedEnvelope(
  parsed: Record<string, unknown>
): MarketingSyncRequestedEnvelope | null {
  if (parsed.eventType !== SYNC_REQUESTED_EVENT_TYPE) return null
  const tenantId = typeof parsed.tenantId === 'string' ? parsed.tenantId.trim() : ''
  const dBname = typeof parsed.dBname === 'string' ? parsed.dBname.trim() : ''
  const occurredAt = typeof parsed.occurredAt === 'string' ? parsed.occurredAt : ''
  const payload = parsed.payload
  if (!tenantId || !dBname || !occurredAt || typeof payload !== 'object' || payload === null) {
    return null
  }
  const p = payload as Record<string, unknown>
  const pTenantId = typeof p.tenantId === 'string' ? p.tenantId.trim() : ''
  const pDbName = typeof p.dBname === 'string' ? p.dBname.trim() : ''
  if (!pTenantId || !pDbName) return null
  const ownerEmails =
    Array.isArray(p.ownerEmails) && p.ownerEmails.length
      ? p.ownerEmails
          .map((x) => (typeof x === 'string' ? x.trim().toLowerCase() : ''))
          .filter(Boolean)
      : []
  return {
    eventType: SYNC_REQUESTED_EVENT_TYPE,
    occurredAt,
    dBname,
    tenantId,
    payload: {
      tenantId: pTenantId,
      dBname: pDbName,
      syncType: typeof p.syncType === 'string' ? p.syncType : 'login_reconcile',
      ...(typeof p.syncId === 'string' ? { syncId: p.syncId } : {}),
      ...(typeof p.chunkIndex === 'number' ? { chunkIndex: p.chunkIndex } : {}),
      ...(typeof p.chunkCount === 'number' ? { chunkCount: p.chunkCount } : {}),
      tenantWideContacts: p.tenantWideContacts === true,
      ...(ownerEmails.length ? { ownerEmails } : {}),
      ...(Array.isArray(p.contacts) ? { contacts: p.contacts as MarketingSyncRequestedEnvelope['payload']['contacts'] } : {}),
      ...(typeof p.requestedByUserId === 'string' ? { requestedByUserId: p.requestedByUserId } : {}),
      ...(typeof p.requestedByEmail === 'string' ? { requestedByEmail: p.requestedByEmail } : {})
    }
  }
}

async function handleMarketingSyncRequested(parsed: Record<string, unknown>): Promise<void> {
  const evt = parseMarketingSyncRequestedEnvelope(parsed)
  if (!evt) {
    logger.warn('Invalid marketing.sync.requested schema', { parsed })
    return
  }
  const startedAt = Date.now()
  const syncedCount = await upsertContactsFromSyncSnapshot({
    tenantId: evt.tenantId,
    dBname: evt.dBname,
    occurredAt: evt.occurredAt,
    contacts: Array.isArray(evt.payload.contacts) ? evt.payload.contacts : []
  })
  logger.info('Kafka inbound marketing.sync.requested', {
    occurredAt: evt.occurredAt,
    tenantId: evt.tenantId,
    dBname: evt.dBname,
    syncType: evt.payload.syncType,
    syncId: evt.payload.syncId ?? '',
    chunkIndex: evt.payload.chunkIndex ?? 1,
    chunkCount: evt.payload.chunkCount ?? 1,
    tenantWideContacts: evt.payload.tenantWideContacts,
    ownerEmailCount: evt.payload.ownerEmails?.length ?? 0,
    requestedByUserId: evt.payload.requestedByUserId ?? '',
    snapshotContactCount: Array.isArray(evt.payload.contacts) ? evt.payload.contacts.length : 0,
    syncedCount,
    durationMs: Date.now() - startedAt
  })
}

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

function hasSaslCredentials(cfg: KafkaRuntime): boolean {
  return buildSaslCredentials(cfg) !== null
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

function useTlsForRemote(cfg: KafkaRuntime): boolean {
  if (isLocalBroker(cfg)) return false
  if (hasSaslCredentials(cfg)) return true
  return cfg.kafkaSsl !== false && String(cfg.kafkaSsl) !== 'false'
}

function buildKafkaClientConfig(cfg: KafkaRuntime, clientId: string): KafkaConfig {
  const brokers = parseBrokers(cfg.kafkaBrokers)
  const sasl = buildSasl(cfg)
  const useSsl = useTlsForRemote(cfg)
  const gcp = brokers.some((b) => b.includes('managedkafka'))
  const base: KafkaConfig = {
    clientId,
    brokers,
    ssl: useSsl,
    ...(sasl && { sasl })
  }
  if (isLocalBroker(cfg)) return base
  return {
    ...base,
    connectionTimeout: 30000,
    authenticationTimeout: 30000,
    requestTimeout: gcp ? 90000 : 45000,
    retry: {
      retries: gcp ? 10 : 5,
      initialRetryTime: 400,
      maxRetryTime: 40000,
      multiplier: 2
    }
  }
}

function createKafkaJsInstance(clientId: string, cfg?: KafkaRuntime): Kafka | null {
  const c = cfg ?? resolveKafkaRuntime()
  const brokers = parseBrokers(c.kafkaBrokers)
  if (brokers.length === 0) return null
  return new Kafka(buildKafkaClientConfig(c, clientId))
}

// --- Per-tenant topics ---------------------------------------------------------

const tenantTopicCache = new Map<string, string>()

function toTopicSuffix(value: string): string {
  const s = value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '_')
  return s || 'tenant'
}

const KAFKA_TOPIC_NAME_MAX_LEN = 249

/**
 * Sanitize a user-supplied **full** Kafka topic name (per-tenant override).
 * Returns `null` if the result would be empty or invalid length.
 */
export function sanitizeKafkaOutboundTopic(raw: string): string | null {
  const t = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '')
    .replace(/_{2,}/g, '_')
  if (!t || t.length > KAFKA_TOPIC_NAME_MAX_LEN) return null
  return t
}

export function getTenantEventTopic(tenantNameOrDbName: string): string {
  const base = resolveKafkaRuntime().kafkaTopicEvents || 'marketing.events'
  return `${base}.${toTopicSuffix(tenantNameOrDbName)}`
}

/**
 * Outbound topic derived from registry display name (preferred) or `dbName`, matching
 * `getTenantEventTopicByDbName` when no separate override is applied.
 */
export function computeDefaultMarketingOutboundTopicForTenant(
  displayName: string,
  tenantDbName: string
): string {
  const name = displayName.trim()
  const source = name || tenantDbName.trim() || 'tenant'
  return getTenantEventTopic(source)
}

export async function getTenantEventTopicByDbName(tenantDbName: string): Promise<string> {
  const cached = tenantTopicCache.get(tenantDbName)
  if (cached) return cached
  let topic: string
  try {
    const registry = await getRegistryConnection()
    const row = await registry
      .collection('clients')
      .findOne({ dbName: tenantDbName })
      .then((d) => d as { name?: string; kafkaOutboundTopic?: string } | null)
    const customRaw =
      typeof row?.kafkaOutboundTopic === 'string' ? row.kafkaOutboundTopic.trim() : ''
    if (customRaw) {
      const direct = sanitizeKafkaOutboundTopic(customRaw)
      if (direct) {
        tenantTopicCache.set(tenantDbName, direct)
        return direct
      }
    }
    topic = getTenantEventTopic(tenantDbName)
    const tenantName = typeof row?.name === 'string' ? row.name.trim() : ''
    if (tenantName) topic = getTenantEventTopic(tenantName)
  } catch {
    topic = getTenantEventTopic(tenantDbName)
  }
  tenantTopicCache.set(tenantDbName, topic)
  return topic
}

export function clearTenantTopicCache(): void {
  tenantTopicCache.clear()
}

export function invalidateTenantTopicCacheForDbName(dbName: string): void {
  const key = dbName.trim()
  if (key) tenantTopicCache.delete(key)
}

async function listInboundSubscriptionTopics(): Promise<string[]> {
  const cfg = resolveKafkaRuntime()
  const topics = new Set<string>()
  topics.add(cfg.kafkaTopicEvents || 'marketing.events')
  try {
    const registry = await getRegistryConnection()
    const rows = await registry.collection('clients').find({}).toArray()
    for (const row of rows) {
      const dbName = typeof row.dbName === 'string' ? row.dbName.trim() : ''
      if (!dbName) continue
      topics.add(await getTenantEventTopicByDbName(dbName))
    }
  } catch {
    /* base topic only */
  }
  return [...topics]
}

// --- Producer ------------------------------------------------------------------

let producer: Producer | null = null
let connectPromise: Promise<Producer | null> | null = null

async function resetProducerConnection(): Promise<void> {
  try {
    if (producer) await producer.disconnect()
  } catch {
    /* ignore */
  }
  producer = null
  connectPromise = null
}

function isKafkaConnectionError(err: unknown): boolean {
  const m = err instanceof Error ? err.message : String(err)
  return /timeout|Connection|ECONNRESET|ECONNREFUSED|socket|TLS|ETIMEDOUT|disconnected/i.test(m)
}

async function getProducer(): Promise<Producer | null> {
  const cfg = resolveKafkaRuntime()
  const brokers = parseBrokers(cfg.kafkaBrokers)
  if (brokers.length === 0) {
    logger.debug('No brokers configured, skip producer')
    return null
  }
  if (producer) return producer
  if (connectPromise) return connectPromise
  connectPromise = (async () => {
    const kafka = new Kafka(buildKafkaClientConfig(cfg, cfg.kafkaClientId))
    const p = kafka.producer({
      allowAutoTopicCreation: true,
      createPartitioner: Partitioners.LegacyPartitioner
    })
    await p.connect()
    producer = p
    logger.info('Kafka producer connected', { brokers: brokers.join(', ') })
    return p
  })().finally(() => {
    connectPromise = null
  })
  return connectPromise
}

// --- Admin ---------------------------------------------------------------------

let admin: Admin | null = null
let adminConnectPromise: Promise<Admin | null> | null = null

async function getAdmin(): Promise<Admin | null> {
  const cfg = resolveKafkaRuntime()
  const brokers = parseBrokers(cfg.kafkaBrokers)
  if (brokers.length === 0) return null
  if (admin) return admin
  if (adminConnectPromise) return adminConnectPromise
  adminConnectPromise = (async () => {
    const kafka = createKafkaJsInstance(`${cfg.kafkaClientId}-admin`, cfg)
    if (!kafka) return null
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

/** Ensure the Kafka topic used for this tenant’s outbound events exists (matches `getTenantEventTopicByDbName`). */
export async function ensureTenantEventTopic(tenantDbName: string): Promise<string | null> {
  if (!isKafkaConfigured()) {
    logger.warn('Kafka: KAFKA_BROKERS is empty; skip tenant topic creation')
    return null
  }
  const topic = await getTenantEventTopicByDbName(tenantDbName.trim())
  const a = await getAdmin()
  if (!a) return null
  const replicationFactor = topicReplicationFactor()
  logger.info('Kafka: ensure topic', { topic, replicationFactor })
  await a.createTopics({
    waitForLeaders: true,
    topics: [{ topic, numPartitions: 1, replicationFactor }]
  })
  return topic
}

// --- Publish -------------------------------------------------------------------

export async function publishMarketingEnvelope(envelope: MarketingKafkaEnvelope): Promise<void> {
  const sendOnce = async () => {
    const p = await getProducer()
    if (!p) return
    const topic = await getTenantEventTopicByDbName(envelope.tenantDbName)
    await p.send({
      topic,
      messages: [{ key: envelope.tenantDbName, value: JSON.stringify(envelope) }]
    })
  }
  try {
    await sendOnce()
  } catch (err) {
    if (isKafkaConnectionError(err) && !isLocalBroker(resolveKafkaRuntime())) {
      logger.warn('Kafka producer send failed, reconnecting once', {
        err: err instanceof Error ? err.message : String(err)
      })
      await resetProducerConnection()
      await sendOnce()
      return
    }
    throw err
  }
}

export async function publishCampaignSendCompleted(params: {
  tenantDbName: string
  tenantId?: string
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

// --- Inbound consumer + routing (handlers: kafka/handlers/*) -------------------

function isInboundPlatformEnvelope(parsed: Record<string, unknown>): boolean {
  const et = typeof parsed.eventType === 'string' ? parsed.eventType : ''
  const tenantId = typeof parsed.tenantId === 'string' ? parsed.tenantId.trim() : ''
  return (
    tenantId.length > 0 &&
    (et.startsWith('contact.') ||
      et.startsWith('account.') ||
      et === SYNC_REQUESTED_EVENT_TYPE ||
      et === EMAIL_TEMPLATE_EVENT_TYPES.CREATED ||
      et === EMAIL_TEMPLATE_EVENT_TYPES.UPDATED ||
      et === EMAIL_TEMPLATE_EVENT_TYPES.DELETED)
  )
}

async function handleInboundKafkaMessage(parsed: Record<string, unknown>): Promise<void> {
  const eventType = typeof parsed.eventType === 'string' ? parsed.eventType : ''
  const contactEvent = parseContactEventEnvelope(parsed)
  const deletedEvent = parseContactDeletedEventEnvelope(parsed)

  switch (eventType) {
    case SYNC_REQUESTED_EVENT_TYPE:
      await handleMarketingSyncRequested(parsed)
      break
    case CONTACT_EVENT_TYPES.CREATED:
      if (!contactEvent) {
        logger.warn('Invalid contact.created schema', { parsed })
        break
      }
      logger.info('Kafka inbound contact.created', {
        occurredAt: contactEvent.occurredAt,
        dBname: contactEvent.dBname,
        tenantId: contactEvent.tenantId,
        externalId: contactEvent.payload.externalId,
        ...(() => {
          const { firstName: fn, lastName: ln } = namesFromContactPayload(contactEvent.payload)
          return {
            firstName: fn,
            lastName: ln,
            displayName: formatContactFullName(fn, ln)
          }
        })(),
        email: contactEvent.payload.email,
        phone: contactEvent.payload.phone ?? '',
        company: contactEvent.payload.company || '',
        address: contactEvent.payload.address,
        contactType: contactEvent.payload.contactType,
        channel: contactEvent.payload.channel
      })
      await createContactFromCreatedEvent(contactEvent)
      logger.info('Contact inserted from Kafka', {
        dBname: contactEvent.dBname,
        tenantId: contactEvent.tenantId,
        externalId: contactEvent.payload.externalId,
        email: contactEvent.payload.email,
        company: contactEvent.payload.company || ''
      })
      break
    case CONTACT_EVENT_TYPES.UPDATED:
      if (!contactEvent) {
        logger.warn('Invalid contact.updated schema', { parsed })
        break
      }
      logger.info('Kafka inbound contact.updated', {
        occurredAt: contactEvent.occurredAt,
        dBname: contactEvent.dBname,
        tenantId: contactEvent.tenantId,
        externalId: contactEvent.payload.externalId,
        ...(() => {
          const { firstName: fn, lastName: ln } = namesFromContactPayload(contactEvent.payload)
          return {
            firstName: fn,
            lastName: ln,
            displayName: formatContactFullName(fn, ln)
          }
        })(),
        email: contactEvent.payload.email,
        phone: contactEvent.payload.phone ?? '',
        company: contactEvent.payload.company || '',
        address: contactEvent.payload.address,
        contactType: contactEvent.payload.contactType,
        channel: contactEvent.payload.channel
      })
      await updateContactFromUpdatedEvent(contactEvent)
      logger.info('Contact upserted from Kafka update', {
        dBname: contactEvent.dBname,
        tenantId: contactEvent.tenantId,
        externalId: contactEvent.payload.externalId,
        email: contactEvent.payload.email,
        contactType: contactEvent.payload.contactType,
        company: contactEvent.payload.company || ''
      })
      break
    case CONTACT_EVENT_TYPES.DELETED:
      if (!deletedEvent) {
        logger.warn('Invalid contact.deleted schema', { parsed })
        break
      }
      logger.info('Kafka inbound contact.deleted', {
        occurredAt: deletedEvent.occurredAt,
        dBname: deletedEvent.dBname,
        tenantId: deletedEvent.tenantId,
        externalId: deletedEvent.payload.externalId
      })
      await softDeleteContactFromDeletedEvent(deletedEvent)
      logger.info('Contact soft-deleted from Kafka', {
        dBname: deletedEvent.dBname,
        tenantId: deletedEvent.tenantId,
        externalId: deletedEvent.payload.externalId
      })
      break
    case EMAIL_TEMPLATE_EVENT_TYPES.CREATED: {
      const emailTplEvent = parseEmailTemplateCreatedEventEnvelope(parsed)
      if (!emailTplEvent) {
        logger.warn('Invalid marketing.email_template.created schema', { parsed })
        break
      }
      await saveMarketingEmailTemplateFromCreatedEvent(emailTplEvent)
      logger.info('Marketing email template upserted from Kafka', {
        occurredAt: emailTplEvent.occurredAt,
        tenantId: emailTplEvent.tenantId,
        dBname: emailTplEvent.dBname,
        externalId: emailTplEvent.payload.externalId
      })
      break
    }
    case EMAIL_TEMPLATE_EVENT_TYPES.UPDATED: {
      const emailTplEvent = parseEmailTemplateUpdatedEventEnvelope(parsed)
      if (!emailTplEvent) {
        logger.warn('Invalid marketing.email_template.updated schema', { parsed })
        break
      }
      await saveMarketingEmailTemplateFromUpdatedEvent(emailTplEvent)
      logger.info('Marketing email template updated from Kafka', {
        occurredAt: emailTplEvent.occurredAt,
        tenantId: emailTplEvent.tenantId,
        dBname: emailTplEvent.dBname,
        externalId: emailTplEvent.payload.externalId
      })
      break
    }
    case EMAIL_TEMPLATE_EVENT_TYPES.DELETED: {
      const emailTplDeleted = parseEmailTemplateDeletedEventEnvelope(parsed)
      if (!emailTplDeleted) {
        logger.warn('Invalid marketing.email_template.deleted schema', { parsed })
        break
      }
      await deleteMarketingEmailTemplateFromDeletedEvent(emailTplDeleted)
      logger.info('Marketing email template deleted from Kafka', {
        occurredAt: emailTplDeleted.occurredAt,
        tenantId: emailTplDeleted.tenantId,
        dBname: emailTplDeleted.dBname,
        externalId: emailTplDeleted.payload.externalId
      })
      break
    }
    default:
      logger.info('Kafka inbound (unhandled eventType)', { eventType })
  }
}

let inboundEventsConsumer: Consumer | null = null

export async function startInboundEventsConsumer(): Promise<void> {
  const g = globalThis as typeof globalThis & { __marketingInboundKafkaConsumerStarted?: boolean }
  if (g.__marketingInboundKafkaConsumerStarted || inboundEventsConsumer) return
  if (!isKafkaConfigured()) {
    logger.debug('Kafka inbound consumer skipped (no brokers)')
    return
  }

  const cfg = resolveKafkaRuntime()
  const kafka = createKafkaJsInstance(`${cfg.kafkaClientId}-inbound`, cfg)
  if (!kafka) return

  const topics = await listInboundSubscriptionTopics()
  const groupId =
    process.env.KAFKA_CONSUMER_GROUP_ID?.trim() || 'new-marketing-inbound-events'
  const fromBeginning = process.env.KAFKA_CONSUMER_FROM_BEGINNING === 'true'

  g.__marketingInboundKafkaConsumerStarted = true

  inboundEventsConsumer = kafka.consumer({
    groupId,
    allowAutoTopicCreation: true
  })

  await inboundEventsConsumer.connect()
  await inboundEventsConsumer.subscribe({ topics, fromBeginning })

  void inboundEventsConsumer
    .run({
      eachMessage: async ({ topic: t, partition, message }) => {
        const raw = message.value?.toString()
        if (!raw) return
        let parsed: Record<string, unknown>
        try {
          parsed = JSON.parse(raw) as Record<string, unknown>
        } catch {
          logger.warn('Kafka inbound consumer skip non-JSON message', { topic: t, partition })
          return
        }

        if (!isInboundPlatformEnvelope(parsed)) return

        try {
          await handleInboundKafkaMessage(parsed)
        } catch (err) {
          logger.error('Kafka inbound handler error', {
            err: err instanceof Error ? err.message : String(err),
            eventType: parsed.eventType
          })
        }
      }
    })
    .catch((err) => {
      logger.error('Kafka inbound consumer run failed', err instanceof Error ? err.message : String(err))
    })

  logger.info('Kafka inbound consumer running', { topics, groupId, fromBeginning })
}
