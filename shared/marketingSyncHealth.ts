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
