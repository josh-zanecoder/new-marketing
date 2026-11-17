/** Per-tenant Marketing Kafka ingest health (registry `marketing_sync_health`). */

export type MarketingSyncHealthStatus = 'ok' | 'syncing' | 'degraded' | 'error' | 'unknown'

export type MarketingSyncHealthMode = 'full' | 'delta' | ''

export type MarketingSyncHealthDoc = {
  /** Registry tenant id (Kafka envelope `tenantId`). */
  tenantId: string
  dbName: string
  tenantName?: string
  kafkaTopic?: string
  status: MarketingSyncHealthStatus
  lastSyncMode?: MarketingSyncHealthMode
  lastSyncId?: string
  lastSyncedCount?: number
  lastChunkIndex?: number
  lastChunkCount?: number
  lastEventType?: string
  lastError?: string
  /** Last ingested contact.* event (create/update/delete). */
  lastContactEventAt?: string
  lastContactEventType?: string
  lastContactType?: string
  lastContactExternalId?: string
  lastContactEmail?: string
  /** ISO timestamps */
  lastSuccessAt?: string
  lastErrorAt?: string
  lastEventAt?: string
  updatedAt: string
}

export type MarketingSyncWorkerHealth = {
  status: 'ok' | 'stale' | 'unknown'
  lastHeartbeatAt?: string
  consumerGroupId?: string
  topics?: string[]
  updatedAt: string
}

export type MarketingSyncHealthLogLevel = 'info' | 'warn' | 'error'

export type MarketingSyncHealthLogKind =
  | 'progress'
  | 'success'
  | 'error'
  | 'worker'
  | 'contact'
  | 'dlq'

export type MarketingSyncHealthLog = {
  id: string
  at: string
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
}

/** Max recent history rows returned / retained for the admin board. */
export const MARKETING_SYNC_HEALTH_LOG_LIMIT = 500

/**
 * Max sync-related log rows retained per tenant (progress / success / error).
 * Keeps full sync run history from being wiped by other tenants' activity.
 */
export const MARKETING_SYNC_TENANT_SYNC_HISTORY_LIMIT = 2_000

/** Max contact ingest log rows retained per tenant. */
export const MARKETING_SYNC_TENANT_CONTACT_LOG_LIMIT = 300

/** Max retained dead-letter rows for skipped Kafka ingest failures. */
export const MARKETING_SYNC_DLQ_LIMIT = 200

export const MARKETING_SYNC_HISTORY_KINDS: MarketingSyncHealthLogKind[] = [
  'progress',
  'success',
  'error'
]

export type MarketingSyncRunSummary = {
  syncId: string
  syncMode?: MarketingSyncHealthMode
  status: 'syncing' | 'ok' | 'error' | 'unknown'
  startedAt?: string
  finishedAt?: string
  syncedCount?: number
  chunkIndex?: number
  chunkCount?: number
  lastMessage?: string
  eventCount: number
  events: MarketingSyncHealthLog[]
}

/** Collapse flat sync logs into newest-first sync runs (by syncId). */
export function groupMarketingSyncRuns(
  logs: MarketingSyncHealthLog[]
): MarketingSyncRunSummary[] {
  const syncLogs = logs.filter((log) =>
    MARKETING_SYNC_HISTORY_KINDS.includes(log.kind)
  )
  const byId = new Map<string, MarketingSyncHealthLog[]>()
  let orphan = 0

  for (const log of syncLogs) {
    const syncId = (log.syncId || '').trim() || `__orphan_${orphan++}`
    const bucket = byId.get(syncId)
    if (bucket) bucket.push(log)
    else byId.set(syncId, [log])
  }

  const runs: MarketingSyncRunSummary[] = []
  for (const [syncId, events] of byId) {
    const sorted = [...events].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    const newest = sorted[sorted.length - 1]
    const oldest = sorted[0]
    const success = [...sorted].reverse().find((e) => e.kind === 'success')
    const error = [...sorted].reverse().find((e) => e.kind === 'error')
    const progress = [...sorted].reverse().find((e) => e.kind === 'progress')

    let status: MarketingSyncRunSummary['status'] = 'unknown'
    if (success && (!error || Date.parse(success.at) >= Date.parse(error.at))) status = 'ok'
    else if (error) status = 'error'
    else if (progress) status = 'syncing'

    const withCounts = [...sorted].reverse().find((e) => typeof e.syncedCount === 'number')
    const withChunks = [...sorted]
      .reverse()
      .find((e) => typeof e.chunkIndex === 'number' || typeof e.chunkCount === 'number')

    runs.push({
      syncId: syncId.startsWith('__orphan_') ? '' : syncId,
      syncMode: newest?.syncMode || oldest?.syncMode,
      status,
      startedAt: oldest?.at,
      finishedAt: success?.at || error?.at || newest?.at,
      syncedCount: withCounts?.syncedCount,
      chunkIndex: withChunks?.chunkIndex,
      chunkCount: withChunks?.chunkCount ?? success?.chunkCount,
      lastMessage: newest?.message,
      eventCount: sorted.length,
      events: sorted
    })
  }

  return runs.sort((a, b) => {
    const aAt = Date.parse(a.finishedAt || a.startedAt || '') || 0
    const bAt = Date.parse(b.finishedAt || b.startedAt || '') || 0
    return bAt - aAt
  })
}

export type MarketingSyncDlqEntry = {
  id: string
  at: string
  error: string
  eventType?: string
  tenantId?: string
  dbName?: string
  kafkaTopic?: string
  partition?: number
  offset?: string
  /** Truncated raw Kafka payload for replay / debug. */
  rawPreview?: string
}

/** Worker heartbeat older than this → stale. */
export const MARKETING_SYNC_WORKER_STALE_MS = 5 * 60 * 1000

/** Ingest error newer than this (without a later success) keeps status error. */
export const MARKETING_SYNC_ERROR_FRESH_MS = 24 * 60 * 60 * 1000

export function deriveMarketingSyncHealthStatus(input: {
  lastSuccessAt?: string
  lastErrorAt?: string
  lastError?: string
  syncing?: boolean
  nowMs?: number
}): MarketingSyncHealthStatus {
  if (input.syncing) return 'syncing'
  const now = input.nowMs ?? Date.now()
  const errAt = input.lastErrorAt ? Date.parse(input.lastErrorAt) : NaN
  const okAt = input.lastSuccessAt ? Date.parse(input.lastSuccessAt) : NaN
  const hasFreshError =
    Boolean(input.lastError) &&
    Number.isFinite(errAt) &&
    now - errAt <= MARKETING_SYNC_ERROR_FRESH_MS
  if (hasFreshError && (!Number.isFinite(okAt) || errAt > okAt)) return 'error'
  if (Number.isFinite(okAt)) return 'ok'
  if (hasFreshError) return 'degraded'
  return 'unknown'
}

export function deriveMarketingSyncWorkerStatus(
  lastHeartbeatAt: string | undefined,
  nowMs = Date.now()
): MarketingSyncWorkerHealth['status'] {
  if (!lastHeartbeatAt) return 'unknown'
  const t = Date.parse(lastHeartbeatAt)
  if (!Number.isFinite(t)) return 'unknown'
  return nowMs - t <= MARKETING_SYNC_WORKER_STALE_MS ? 'ok' : 'stale'
}
