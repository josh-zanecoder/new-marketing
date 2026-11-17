import { randomUUID } from 'node:crypto'
import { getRegistryConnection } from '@server/lib/mongoose'
import {
  deriveMarketingSyncHealthStatus,
  deriveMarketingSyncWorkerStatus,
  MARKETING_SYNC_HEALTH_LOG_LIMIT,
  type MarketingSyncHealthDoc,
  type MarketingSyncHealthLog,
  type MarketingSyncHealthLogKind,
  type MarketingSyncHealthLogLevel,
  type MarketingSyncHealthMode,
  type MarketingSyncWorkerHealth
} from '~~/shared/marketingSyncHealth'

export const MARKETING_SYNC_HEALTH_COLLECTION = 'marketing_sync_health'
export const MARKETING_SYNC_HEALTH_LOGS_COLLECTION = 'marketing_sync_health_logs'
export const MARKETING_SYNC_WORKER_HEALTH_ID = 'kafka-inbound-worker'

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
    createdAt: at
  }

  await registry.collection(MARKETING_SYNC_HEALTH_LOGS_COLLECTION).insertOne(doc)

  // Keep the collection bounded for the admin board.
  const overflow = await registry
    .collection(MARKETING_SYNC_HEALTH_LOGS_COLLECTION)
    .find({}, { projection: { _id: 1 } })
    .sort({ at: -1 })
    .skip(MARKETING_SYNC_HEALTH_LOG_LIMIT)
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
    kafkaTopic: typeof row.kafkaTopic === 'string' && row.kafkaTopic ? row.kafkaTopic : undefined
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

export async function recordMarketingSyncError(input: {
  tenantId?: string
  dbName?: string
  error: string
  eventType?: string
  kafkaTopic?: string
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
