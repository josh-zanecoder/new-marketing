import { randomUUID } from 'node:crypto'
import { getRegistryConnection } from '@server/lib/mongoose'
import {
  deriveMarketingSyncHealthStatus,
  deriveMarketingSyncWorkerStatus,
  MARKETING_SYNC_DLQ_LIMIT,
  MARKETING_SYNC_HEALTH_LOG_LIMIT,
  MARKETING_SYNC_HISTORY_KINDS,
  MARKETING_SYNC_TENANT_CONTACT_LOG_LIMIT,
  MARKETING_SYNC_TENANT_SYNC_HISTORY_LIMIT,
  type MarketingSyncDlqEntry,
  type MarketingSyncHealthDoc,
  type MarketingSyncHealthLog,
  type MarketingSyncHealthLogKind,
  type MarketingSyncHealthLogLevel,
  type MarketingSyncHealthMode,
  type MarketingSyncWorkerHealth
} from '~~/shared/marketingSyncHealth'

export const MARKETING_SYNC_HEALTH_COLLECTION = 'marketing_sync_health'
export const MARKETING_SYNC_HEALTH_LOGS_COLLECTION = 'marketing_sync_health_logs'
export const MARKETING_SYNC_DLQ_COLLECTION = 'marketing_sync_health_dlq'
export const MARKETING_SYNC_WORKER_HEALTH_ID = 'kafka-inbound-worker'

const DLQ_RAW_PREVIEW_MAX = 4_000

function nowIso(): string {
  return new Date().toISOString()
}

function tenantKey(tenantId: string, dbName: string): string {
  return `${tenantId.trim()}::${dbName.trim()}`
}

async function appendMarketingSyncHealthLog(input: {
  level: MarketingSyncHealthLogLevel
  kind: MarketingSyncHealthLogKind
  message: string
  tenantId?: string
  dbName?: string
  syncMode?: MarketingSyncHealthMode
  syncId?: string
  syncedCount?: number
  chunkIndex?: number
  chunkCount?: number
  eventType?: string
  kafkaTopic?: string
  contactType?: string
  externalId?: string
  email?: string
  contactName?: string
  at?: string
}): Promise<void> {
  const message = String(input.message || '').trim().slice(0, 800)
  if (!message) return

  const registry = await getRegistryConnection()
  const at = input.at || nowIso()
  const doc = {
    key: randomUUID(),
    at,
    level: input.level,
    kind: input.kind,
    message,
    tenantId: input.tenantId || '',
    dbName: input.dbName || '',
    syncMode: input.syncMode || '',
    syncId: input.syncId || '',
    syncedCount: typeof input.syncedCount === 'number' ? input.syncedCount : null,
    chunkIndex: typeof input.chunkIndex === 'number' ? input.chunkIndex : null,
    chunkCount: typeof input.chunkCount === 'number' ? input.chunkCount : null,
    eventType: input.eventType || '',
    kafkaTopic: input.kafkaTopic || '',
    contactType: input.contactType || '',
    externalId: input.externalId || '',
    email: input.email || '',
    contactName: input.contactName || '',
    createdAt: new Date(at)
  }

  await registry.collection(MARKETING_SYNC_HEALTH_LOGS_COLLECTION).insertOne(doc)
  await pruneMarketingSyncHealthLogsAfterAppend({
    dbName: doc.dbName,
    kind: doc.kind as MarketingSyncHealthLogKind
  })
}

async function pruneMarketingSyncHealthLogsAfterAppend(input: {
  dbName: string
  kind: MarketingSyncHealthLogKind
}): Promise<void> {
  const registry = await getRegistryConnection()
  const dbName = String(input.dbName || '').trim()
  const kind = input.kind

  let filter: Record<string, unknown>
  let keep: number

  if (dbName && MARKETING_SYNC_HISTORY_KINDS.includes(kind)) {
    // Retain full sync history per tenant (not a single global 500-row window).
    filter = { dbName, kind: { $in: [...MARKETING_SYNC_HISTORY_KINDS] } }
    keep = MARKETING_SYNC_TENANT_SYNC_HISTORY_LIMIT
  } else if (dbName && kind === 'contact') {
    filter = { dbName, kind: 'contact' }
    keep = MARKETING_SYNC_TENANT_CONTACT_LOG_LIMIT
  } else {
    // Worker / DLQ / unscoped rows: keep the global board window.
    filter = {
      $or: [{ dbName: '' }, { dbName: { $exists: false } }, { kind: { $in: ['worker', 'dlq'] } }]
    }
    keep = MARKETING_SYNC_HEALTH_LOG_LIMIT
  }

  const overflow = await registry
    .collection(MARKETING_SYNC_HEALTH_LOGS_COLLECTION)
    .find(filter, { projection: { _id: 1 } })
    .sort({ at: -1 })
    .skip(keep)
    .limit(200)
    .toArray()
  if (overflow.length > 0) {
    await registry.collection(MARKETING_SYNC_HEALTH_LOGS_COLLECTION).deleteMany({
      _id: { $in: overflow.map((row) => row._id) }
    })
  }
}

function mapLogRow(row: Record<string, unknown>): MarketingSyncHealthLog {
  return {
    id: String(row.key || row._id || ''),
    at: typeof row.at === 'string' ? row.at : nowIso(),
    level: (row.level as MarketingSyncHealthLogLevel) || 'info',
    kind: (row.kind as MarketingSyncHealthLogKind) || 'progress',
    message: String(row.message || ''),
    tenantId: typeof row.tenantId === 'string' && row.tenantId ? row.tenantId : undefined,
    dbName: typeof row.dbName === 'string' && row.dbName ? row.dbName : undefined,
    syncMode: (row.syncMode as MarketingSyncHealthMode) || undefined,
    syncId: typeof row.syncId === 'string' && row.syncId ? row.syncId : undefined,
    syncedCount: typeof row.syncedCount === 'number' ? row.syncedCount : undefined,
    chunkIndex: typeof row.chunkIndex === 'number' ? row.chunkIndex : undefined,
    chunkCount: typeof row.chunkCount === 'number' ? row.chunkCount : undefined,
    eventType: typeof row.eventType === 'string' && row.eventType ? row.eventType : undefined,
    kafkaTopic: typeof row.kafkaTopic === 'string' && row.kafkaTopic ? row.kafkaTopic : undefined,
    contactType: typeof row.contactType === 'string' && row.contactType ? row.contactType : undefined,
    externalId: typeof row.externalId === 'string' && row.externalId ? row.externalId : undefined,
    email: typeof row.email === 'string' && row.email ? row.email : undefined,
    contactName: typeof row.contactName === 'string' && row.contactName ? row.contactName : undefined
  }
}

export async function listMarketingSyncHealthLogs(
  limit = MARKETING_SYNC_HEALTH_LOG_LIMIT
): Promise<MarketingSyncHealthLog[]> {
  const registry = await getRegistryConnection()
  const take = Math.min(Math.max(1, limit), MARKETING_SYNC_HEALTH_LOG_LIMIT)
  const rows = await registry
    .collection(MARKETING_SYNC_HEALTH_LOGS_COLLECTION)
    .find({})
    .sort({ at: -1 })
    .limit(take)
    .toArray()
  return rows.map((row) => mapLogRow(row as Record<string, unknown>))
}

/** Full sync history for one tenant (progress / success / error), newest first. */
export async function listMarketingSyncHealthLogsForTenant(input: {
  dbName: string
  limit?: number
  /** When true, also include contact + dlq log kinds for the tenant. */
  includeContacts?: boolean
}): Promise<MarketingSyncHealthLog[]> {
  const dbName = String(input.dbName || '').trim()
  if (!dbName) return []

  const registry = await getRegistryConnection()
  const kinds = input.includeContacts
    ? [...MARKETING_SYNC_HISTORY_KINDS, 'contact' as const, 'dlq' as const]
    : [...MARKETING_SYNC_HISTORY_KINDS]
  const defaultLimit = input.includeContacts
    ? MARKETING_SYNC_TENANT_SYNC_HISTORY_LIMIT + MARKETING_SYNC_TENANT_CONTACT_LOG_LIMIT
    : MARKETING_SYNC_TENANT_SYNC_HISTORY_LIMIT
  const maxLimit = MARKETING_SYNC_TENANT_SYNC_HISTORY_LIMIT + MARKETING_SYNC_TENANT_CONTACT_LOG_LIMIT
  const take = Math.min(Math.max(1, input.limit ?? defaultLimit), maxLimit)
  const rows = await registry
    .collection(MARKETING_SYNC_HEALTH_LOGS_COLLECTION)
    .find({
      dbName,
      kind: { $in: kinds }
    })
    .sort({ at: -1 })
    .limit(take)
    .toArray()
  return rows.map((row) => mapLogRow(row as Record<string, unknown>))
}

function mapDlqRow(row: Record<string, unknown>): MarketingSyncDlqEntry {
  return {
    id: String(row.key || row._id || ''),
    at: typeof row.at === 'string' ? row.at : nowIso(),
    error: String(row.error || ''),
    eventType: typeof row.eventType === 'string' && row.eventType ? row.eventType : undefined,
    tenantId: typeof row.tenantId === 'string' && row.tenantId ? row.tenantId : undefined,
    dbName: typeof row.dbName === 'string' && row.dbName ? row.dbName : undefined,
    kafkaTopic: typeof row.kafkaTopic === 'string' && row.kafkaTopic ? row.kafkaTopic : undefined,
    partition: typeof row.partition === 'number' ? row.partition : undefined,
    offset: typeof row.offset === 'string' && row.offset ? row.offset : undefined,
    rawPreview: typeof row.rawPreview === 'string' && row.rawPreview ? row.rawPreview : undefined
  }
}

export async function listMarketingSyncDlqEntries(
  limit = MARKETING_SYNC_DLQ_LIMIT
): Promise<MarketingSyncDlqEntry[]> {
  const registry = await getRegistryConnection()
  const take = Math.min(Math.max(1, limit), MARKETING_SYNC_DLQ_LIMIT)
  const rows = await registry
    .collection(MARKETING_SYNC_DLQ_COLLECTION)
    .find({})
    .sort({ at: -1 })
    .limit(take)
    .toArray()
  return rows.map((row) => mapDlqRow(row as Record<string, unknown>))
}

export async function listMarketingSyncDlqEntriesForTenant(input: {
  dbName: string
  limit?: number
}): Promise<MarketingSyncDlqEntry[]> {
  const dbName = String(input.dbName || '').trim()
  if (!dbName) return []
  const registry = await getRegistryConnection()
  const take = Math.min(Math.max(1, input.limit ?? MARKETING_SYNC_DLQ_LIMIT), MARKETING_SYNC_DLQ_LIMIT)
  const rows = await registry
    .collection(MARKETING_SYNC_DLQ_COLLECTION)
    .find({ dbName })
    .sort({ at: -1 })
    .limit(take)
    .toArray()
  return rows.map((row) => mapDlqRow(row as Record<string, unknown>))
}

export async function getMarketingSyncDlqEntry(
  id: string
): Promise<MarketingSyncDlqEntry | null> {
  const key = String(id || '').trim()
  if (!key) return null
  const registry = await getRegistryConnection()
  const row = await registry.collection(MARKETING_SYNC_DLQ_COLLECTION).findOne({ key })
  if (!row) return null
  return mapDlqRow(row as Record<string, unknown>)
}

/** Acknowledge / discard a DLQ row (does not reprocess the payload). */
export async function ackMarketingSyncDlqEntry(id: string): Promise<boolean> {
  const key = String(id || '').trim()
  if (!key) return false
  const registry = await getRegistryConnection()
  const result = await registry.collection(MARKETING_SYNC_DLQ_COLLECTION).deleteOne({ key })
  return (result.deletedCount || 0) > 0
}

/**
 * Clear sticky error / stuck-syncing state for a tenant health doc.
 * Does not delete history logs or DLQ rows.
 */
export async function clearMarketingSyncTenantHealth(input: {
  dbName: string
  tenantId?: string
}): Promise<boolean> {
  const dbName = String(input.dbName || '').trim()
  if (!dbName) return false

  const registry = await getRegistryConnection()
  const tenantId = String(input.tenantId || '').trim()
  const filter = tenantId
    ? { key: tenantKey(tenantId, dbName) }
    : { dbName, _kind: { $ne: 'worker' } }

  const at = nowIso()
  const existing = (await registry
    .collection(MARKETING_SYNC_HEALTH_COLLECTION)
    .findOne(filter)) as (MarketingSyncHealthDoc & { tenantId?: string }) | null
  if (!existing) return false

  const result = await registry.collection(MARKETING_SYNC_HEALTH_COLLECTION).updateMany(filter, {
    $set: {
      status: 'unknown',
      lastError: '',
      lastErrorAt: '',
      updatedAt: at
    }
  })

  if ((result.matchedCount || 0) === 0) return false

  await appendMarketingSyncHealthLog({
    level: 'warn',
    kind: 'worker',
    message: 'Admin cleared sticky sync health error / syncing state',
    tenantId: tenantId || existing.tenantId || '',
    dbName,
    at
  })
  return true
}

/** Ensure query indexes (+ 90d TTL on createdAt) for sync health collections. */
export async function ensureMarketingSyncHealthIndexes(): Promise<{
  health: string[]
  logs: string[]
  dlq: string[]
}> {
  const registry = await getRegistryConnection()
  const createSafe = async (
    collection: string,
    specs: { key: Record<string, 1 | -1>; unique?: boolean; name: string; expireAfterSeconds?: number }[]
  ): Promise<string[]> => {
    try {
      return await registry.collection(collection).createIndexes(specs)
    } catch (err) {
      // Index already exists with different options, etc. — non-fatal for ops board.
      return [
        `error:${err instanceof Error ? err.message : String(err)}`.slice(0, 200)
      ]
    }
  }

  const [health, logs, dlq] = await Promise.all([
    createSafe(MARKETING_SYNC_HEALTH_COLLECTION, [
      { key: { key: 1 }, unique: true, name: 'key_unique' },
      { key: { dbName: 1 }, name: 'dbName' },
      { key: { status: 1, updatedAt: -1 }, name: 'status_updatedAt' }
    ]),
    createSafe(MARKETING_SYNC_HEALTH_LOGS_COLLECTION, [
      { key: { at: -1 }, name: 'at_desc' },
      { key: { dbName: 1, kind: 1, at: -1 }, name: 'dbName_kind_at' },
      {
        key: { createdAt: 1 },
        name: 'createdAt_ttl_90d',
        expireAfterSeconds: 90 * 24 * 60 * 60
      }
    ]),
    createSafe(MARKETING_SYNC_DLQ_COLLECTION, [
      { key: { key: 1 }, unique: true, name: 'key_unique' },
      { key: { at: -1 }, name: 'at_desc' },
      { key: { dbName: 1, at: -1 }, name: 'dbName_at' },
      {
        key: { createdAt: 1 },
        name: 'createdAt_ttl_90d',
        expireAfterSeconds: 90 * 24 * 60 * 60
      }
    ])
  ])

  return { health, logs, dlq }
}

/**
 * Persist a skipped (swallowed) Kafka ingest failure so multi-tenant continue
 * does not lose the poison message forever.
 */
export async function recordMarketingSyncDlq(input: {
  error: string
  eventType?: string
  tenantId?: string
  dbName?: string
  kafkaTopic?: string
  partition?: number
  offset?: string
  raw?: string
}): Promise<void> {
  const error = String(input.error || '').trim().slice(0, 500)
  if (!error) return

  const registry = await getRegistryConnection()
  const at = nowIso()
  const raw = String(input.raw || '')
  const rawPreview = raw ? raw.slice(0, DLQ_RAW_PREVIEW_MAX) : ''
  const tenantId = String(input.tenantId || '').trim()
  const dbName = String(input.dbName || '').trim()
  const eventType = String(input.eventType || '').trim()
  const kafkaTopic = String(input.kafkaTopic || '').trim()

  await registry.collection(MARKETING_SYNC_DLQ_COLLECTION).insertOne({
    key: randomUUID(),
    at,
    error,
    eventType,
    tenantId,
    dbName,
    kafkaTopic,
    partition: typeof input.partition === 'number' ? input.partition : null,
    offset: String(input.offset || ''),
    rawPreview,
    createdAt: new Date(at)
  })

  const overflow = await registry
    .collection(MARKETING_SYNC_DLQ_COLLECTION)
    .find({}, { projection: { _id: 1 } })
    .sort({ at: -1 })
    .skip(MARKETING_SYNC_DLQ_LIMIT)
    .limit(200)
    .toArray()
  if (overflow.length > 0) {
    await registry.collection(MARKETING_SYNC_DLQ_COLLECTION).deleteMany({
      _id: { $in: overflow.map((row) => row._id) }
    })
  }

  await appendMarketingSyncHealthLog({
    level: 'error',
    kind: 'dlq',
    message: `DLQ: ${error}`,
    tenantId,
    dbName,
    eventType,
    kafkaTopic,
    at
  })
}

export async function recordMarketingSyncProgress(input: {
  tenantId: string
  dbName: string
  syncMode?: MarketingSyncHealthMode
  syncId?: string
  syncedCount?: number
  chunkIndex?: number
  chunkCount?: number
  eventType?: string
  kafkaTopic?: string
  syncing?: boolean
  /** When false, updates status only (no log row). Default true. */
  appendLog?: boolean
}): Promise<void> {
  const tenantId = String(input.tenantId || '').trim()
  const dbName = String(input.dbName || '').trim()
  if (!tenantId || !dbName) return

  const registry = await getRegistryConnection()
  const at = nowIso()
  const syncing = input.syncing === true
  const existing = (await registry.collection(MARKETING_SYNC_HEALTH_COLLECTION).findOne({
    key: tenantKey(tenantId, dbName)
  })) as MarketingSyncHealthDoc | null

  const status = deriveMarketingSyncHealthStatus({
    lastSuccessAt: existing?.lastSuccessAt,
    lastErrorAt: existing?.lastErrorAt,
    lastError: existing?.lastError,
    syncing
  })

  const syncMode = input.syncMode || existing?.lastSyncMode || ''
  const syncId = input.syncId || existing?.lastSyncId || ''
  const syncedCount =
    typeof input.syncedCount === 'number' ? input.syncedCount : existing?.lastSyncedCount
  const chunkIndex =
    typeof input.chunkIndex === 'number' ? input.chunkIndex : existing?.lastChunkIndex
  const chunkCount =
    typeof input.chunkCount === 'number' ? input.chunkCount : existing?.lastChunkCount
  const eventType = input.eventType || existing?.lastEventType || ''
  const kafkaTopic = input.kafkaTopic || existing?.kafkaTopic || ''

  await registry.collection(MARKETING_SYNC_HEALTH_COLLECTION).updateOne(
    { key: tenantKey(tenantId, dbName) },
    {
      $set: {
        key: tenantKey(tenantId, dbName),
        tenantId,
        dbName,
        status,
        lastSyncMode: syncMode,
        lastSyncId: syncId,
        lastSyncedCount: syncedCount,
        lastChunkIndex: chunkIndex,
        lastChunkCount: chunkCount,
        lastEventType: eventType,
        kafkaTopic,
        lastEventAt: at,
        updatedAt: at
      },
      $setOnInsert: {
        createdAt: at
      }
    },
    { upsert: true }
  )

  // Final-chunk non-syncing progress is followed by recordMarketingSyncSuccess — skip duplicate log.
  if (syncing && input.appendLog !== false) {
    const isStart =
      typeof chunkIndex !== 'number' ||
      chunkIndex <= 1 ||
      typeof syncedCount !== 'number'
    const chunkLabel =
      typeof chunkIndex === 'number' && typeof chunkCount === 'number'
        ? ` chunk ${chunkIndex}/${chunkCount}`
        : ''
    const countLabel = typeof syncedCount === 'number' ? ` · ${syncedCount} contacts` : ''
    await appendMarketingSyncHealthLog({
      level: 'info',
      kind: 'progress',
      message: `${isStart ? 'Sync started' : 'Sync progress'} (${syncMode || 'unknown'})${chunkLabel}${countLabel}`,
      tenantId,
      dbName,
      syncMode: (syncMode as MarketingSyncHealthMode) || '',
      syncId,
      syncedCount: typeof syncedCount === 'number' ? syncedCount : undefined,
      chunkIndex: typeof chunkIndex === 'number' ? chunkIndex : undefined,
      chunkCount: typeof chunkCount === 'number' ? chunkCount : undefined,
      eventType,
      kafkaTopic,
      at
    })
  }
}

export async function recordMarketingSyncSuccess(input: {
  tenantId: string
  dbName: string
  syncMode?: MarketingSyncHealthMode
  syncId?: string
  syncedCount?: number
  chunkCount?: number
  eventType?: string
  kafkaTopic?: string
}): Promise<void> {
  const tenantId = String(input.tenantId || '').trim()
  const dbName = String(input.dbName || '').trim()
  if (!tenantId || !dbName) return

  const registry = await getRegistryConnection()
  const at = nowIso()

  const syncMode = input.syncMode || ''
  const syncId = input.syncId || ''
  const eventType = input.eventType || 'marketing.sync.completed'
  const kafkaTopic = input.kafkaTopic || ''

  await registry.collection(MARKETING_SYNC_HEALTH_COLLECTION).updateOne(
    { key: tenantKey(tenantId, dbName) },
    {
      $set: {
        key: tenantKey(tenantId, dbName),
        tenantId,
        dbName,
        status: 'ok',
        lastSyncMode: syncMode,
        lastSyncId: syncId,
        lastSyncedCount: input.syncedCount,
        lastChunkCount: input.chunkCount,
        lastEventType: eventType,
        kafkaTopic,
        lastSuccessAt: at,
        lastEventAt: at,
        lastError: '',
        updatedAt: at
      },
      $setOnInsert: {
        createdAt: at
      }
    },
    { upsert: true }
  )

  const countLabel =
    typeof input.syncedCount === 'number' ? ` · ${input.syncedCount} contacts` : ''
  const chunkLabel =
    typeof input.chunkCount === 'number' ? ` · ${input.chunkCount} chunks` : ''
  await appendMarketingSyncHealthLog({
    level: 'info',
    kind: 'success',
    message: `Sync completed (${syncMode || 'unknown'})${chunkLabel}${countLabel}`,
    tenantId,
    dbName,
    syncMode,
    syncId,
    syncedCount: input.syncedCount,
    chunkCount: input.chunkCount,
    eventType,
    kafkaTopic,
    at
  })
}

export async function recordMarketingContactIngest(input: {
  tenantId: string
  dbName: string
  eventType: string
  kafkaTopic?: string
  contactType?: string
  externalId?: string
  email?: string
  contactName?: string
  company?: string
}): Promise<void> {
  const tenantId = String(input.tenantId || '').trim()
  const dbName = String(input.dbName || '').trim()
  if (!tenantId || !dbName || !input.eventType) return

  const registry = await getRegistryConnection()
  const at = nowIso()
  const contactType = String(input.contactType || '').trim()
  const externalId = String(input.externalId || '').trim()
  const email = String(input.email || '').trim().toLowerCase()
  const contactName = String(input.contactName || '').trim()
  const company = String(input.company || '').trim()
  const kafkaTopic = String(input.kafkaTopic || '').trim()

  const existing = (await registry.collection(MARKETING_SYNC_HEALTH_COLLECTION).findOne({
    key: tenantKey(tenantId, dbName)
  })) as MarketingSyncHealthDoc | null

  const status = deriveMarketingSyncHealthStatus({
    lastSuccessAt: existing?.lastSuccessAt,
    lastErrorAt: existing?.lastErrorAt,
    lastError: existing?.lastError
  })

  await registry.collection(MARKETING_SYNC_HEALTH_COLLECTION).updateOne(
    { key: tenantKey(tenantId, dbName) },
    {
      $set: {
        key: tenantKey(tenantId, dbName),
        tenantId,
        dbName,
        status,
        lastEventType: input.eventType,
        lastContactEventAt: at,
        lastContactEventType: input.eventType,
        lastContactType: contactType,
        lastContactExternalId: externalId,
        lastContactEmail: email,
        kafkaTopic: kafkaTopic || existing?.kafkaTopic || '',
        lastEventAt: at,
        updatedAt: at
      },
      $setOnInsert: {
        createdAt: at
      }
    },
    { upsert: true }
  )

  const who =
    contactName ||
    email ||
    externalId ||
    'contact'
  const typeLabel = contactType || 'unknown'
  const companyLabel = company ? ` · ${company}` : ''
  const action =
    input.eventType === 'contact.created'
      ? 'created'
      : input.eventType === 'contact.updated'
        ? 'updated'
        : input.eventType === 'contact.deleted'
          ? 'deleted'
          : input.eventType

  await appendMarketingSyncHealthLog({
    level: 'info',
    kind: 'contact',
    message: `${typeLabel} ${action}: ${who}${companyLabel}`,
    tenantId,
    dbName,
    eventType: input.eventType,
    kafkaTopic,
    contactType,
    externalId,
    email,
    contactName,
    at
  })
}

export async function recordMarketingSyncError(input: {
  tenantId?: string
  dbName?: string
  error: string
  eventType?: string
  kafkaTopic?: string
  syncId?: string
  syncMode?: MarketingSyncHealthMode
}): Promise<void> {
  const tenantId = String(input.tenantId || '').trim()
  const dbName = String(input.dbName || '').trim()
  const error = String(input.error || '').trim().slice(0, 500)
  if (!error) return

  const registry = await getRegistryConnection()
  const at = nowIso()

  if (!tenantId || !dbName) {
    // Global worker-level error without tenant context.
    await touchMarketingSyncWorkerHeartbeat({
      lastError: error,
      lastErrorAt: at
    })
    await appendMarketingSyncHealthLog({
      level: 'error',
      kind: 'worker',
      message: `Worker error: ${error}`,
      eventType: input.eventType,
      kafkaTopic: input.kafkaTopic,
      at
    })
    return
  }

  const existing = (await registry.collection(MARKETING_SYNC_HEALTH_COLLECTION).findOne({
    key: tenantKey(tenantId, dbName)
  })) as MarketingSyncHealthDoc | null

  const status = deriveMarketingSyncHealthStatus({
    lastSuccessAt: existing?.lastSuccessAt,
    lastErrorAt: at,
    lastError: error
  })
  const eventType = input.eventType || existing?.lastEventType || ''
  const kafkaTopic = input.kafkaTopic || existing?.kafkaTopic || ''
  const syncId = String(input.syncId || existing?.lastSyncId || '').trim()
  const syncMode = (input.syncMode || existing?.lastSyncMode || '') as MarketingSyncHealthMode

  await registry.collection(MARKETING_SYNC_HEALTH_COLLECTION).updateOne(
    { key: tenantKey(tenantId, dbName) },
    {
      $set: {
        key: tenantKey(tenantId, dbName),
        tenantId,
        dbName,
        status,
        lastError: error,
        lastErrorAt: at,
        lastEventType: eventType,
        lastSyncId: syncId || existing?.lastSyncId || '',
        lastSyncMode: syncMode || existing?.lastSyncMode || '',
        kafkaTopic,
        lastEventAt: at,
        updatedAt: at
      },
      $setOnInsert: {
        createdAt: at
      }
    },
    { upsert: true }
  )

  await appendMarketingSyncHealthLog({
    level: 'error',
    kind: 'error',
    message: error,
    tenantId,
    dbName,
    syncMode,
    syncId,
    eventType,
    kafkaTopic,
    at
  })
}

export async function touchMarketingSyncWorkerHeartbeat(extra?: {
  consumerGroupId?: string
  topics?: string[]
  lastError?: string
  lastErrorAt?: string
}): Promise<void> {
  const registry = await getRegistryConnection()
  const at = nowIso()
  const $set: Record<string, unknown> = {
    _kind: 'worker',
    lastHeartbeatAt: at,
    updatedAt: at,
    status: 'ok'
  }
  if (extra?.consumerGroupId) $set.consumerGroupId = extra.consumerGroupId
  if (extra?.topics) $set.topics = extra.topics
  if (extra?.lastError) $set.lastError = extra.lastError
  if (extra?.lastErrorAt) $set.lastErrorAt = extra.lastErrorAt

  $set.key = MARKETING_SYNC_WORKER_HEALTH_ID
  await registry.collection(MARKETING_SYNC_HEALTH_COLLECTION).updateOne(
    { key: MARKETING_SYNC_WORKER_HEALTH_ID },
    { $set, $setOnInsert: { createdAt: at } },
    { upsert: true }
  )
}

export async function listMarketingSyncHealthDocs(): Promise<MarketingSyncHealthDoc[]> {
  const registry = await getRegistryConnection()
  const rows = await registry
    .collection(MARKETING_SYNC_HEALTH_COLLECTION)
    .find({ _kind: { $ne: 'worker' } })
    .toArray()

  const syncingStaleMs = 2 * 60 * 60 * 1000
  const nowMs = Date.now()

  return rows.map((row) => {
    const r = row as Record<string, unknown>
    const lastSuccessAt = typeof r.lastSuccessAt === 'string' ? r.lastSuccessAt : undefined
    const lastErrorAt = typeof r.lastErrorAt === 'string' ? r.lastErrorAt : undefined
    const lastError = typeof r.lastError === 'string' ? r.lastError : undefined
    const lastEventAt = typeof r.lastEventAt === 'string' ? r.lastEventAt : undefined
    const eventAtMs = lastEventAt ? Date.parse(lastEventAt) : NaN
    const syncing =
      r.status === 'syncing' &&
      Number.isFinite(eventAtMs) &&
      nowMs - eventAtMs <= syncingStaleMs
    const doc: MarketingSyncHealthDoc = {
      tenantId: String(r.tenantId || ''),
      dbName: String(r.dbName || ''),
      tenantName: typeof r.tenantName === 'string' ? r.tenantName : undefined,
      kafkaTopic: typeof r.kafkaTopic === 'string' ? r.kafkaTopic : undefined,
      status: deriveMarketingSyncHealthStatus({
        lastSuccessAt,
        lastErrorAt,
        lastError,
        syncing,
        nowMs
      }),
      lastSyncMode: (r.lastSyncMode as MarketingSyncHealthMode) || '',
      lastSyncId: typeof r.lastSyncId === 'string' ? r.lastSyncId : undefined,
      lastSyncedCount: typeof r.lastSyncedCount === 'number' ? r.lastSyncedCount : undefined,
      lastChunkIndex: typeof r.lastChunkIndex === 'number' ? r.lastChunkIndex : undefined,
      lastChunkCount: typeof r.lastChunkCount === 'number' ? r.lastChunkCount : undefined,
      lastEventType: typeof r.lastEventType === 'string' ? r.lastEventType : undefined,
      lastError,
      lastContactEventAt:
        typeof r.lastContactEventAt === 'string' ? r.lastContactEventAt : undefined,
      lastContactEventType:
        typeof r.lastContactEventType === 'string' ? r.lastContactEventType : undefined,
      lastContactType: typeof r.lastContactType === 'string' ? r.lastContactType : undefined,
      lastContactExternalId:
        typeof r.lastContactExternalId === 'string' ? r.lastContactExternalId : undefined,
      lastContactEmail: typeof r.lastContactEmail === 'string' ? r.lastContactEmail : undefined,
      lastSuccessAt,
      lastErrorAt,
      lastEventAt,
      updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : nowIso()
    }
    return doc
  })
}

export async function getMarketingSyncWorkerHealth(): Promise<MarketingSyncWorkerHealth> {
  const registry = await getRegistryConnection()
  const row = (await registry.collection(MARKETING_SYNC_HEALTH_COLLECTION).findOne({
    key: MARKETING_SYNC_WORKER_HEALTH_ID
  })) as Record<string, unknown> | null

  const lastHeartbeatAt =
    typeof row?.lastHeartbeatAt === 'string' ? row.lastHeartbeatAt : undefined
  const status = deriveMarketingSyncWorkerStatus(lastHeartbeatAt)
  return {
    status,
    lastHeartbeatAt,
    consumerGroupId: typeof row?.consumerGroupId === 'string' ? row.consumerGroupId : undefined,
    topics: Array.isArray(row?.topics) ? row.topics.map(String) : undefined,
    updatedAt: typeof row?.updatedAt === 'string' ? row.updatedAt : nowIso()
  }
}
