import { describe, expect, it } from 'vitest'
import {
  deriveMarketingSyncHealthStatus,
  deriveMarketingSyncWorkerStatus,
  groupMarketingSyncRuns,
  MARKETING_SYNC_ERROR_FRESH_MS,
  MARKETING_SYNC_WORKER_STALE_MS,
  type MarketingSyncHealthLog
} from './marketingSyncHealth'

function log(
  partial: Partial<MarketingSyncHealthLog> & Pick<MarketingSyncHealthLog, 'id' | 'at' | 'kind' | 'message'>
): MarketingSyncHealthLog {
  return {
    level: 'info',
    ...partial
  }
}

describe('deriveMarketingSyncHealthStatus', () => {
  const nowMs = Date.parse('2026-11-17T12:00:00.000Z')

  it('returns syncing when flagged', () => {
    expect(deriveMarketingSyncHealthStatus({ syncing: true, nowMs })).toBe('syncing')
  })

  it('returns error when last error is fresher than success', () => {
    expect(
      deriveMarketingSyncHealthStatus({
        lastSuccessAt: '2026-11-16T10:00:00.000Z',
        lastErrorAt: '2026-11-17T11:00:00.000Z',
        lastError: 'boom',
        nowMs
      })
    ).toBe('error')
  })

  it('returns ok when success is newer than error', () => {
    expect(
      deriveMarketingSyncHealthStatus({
        lastSuccessAt: '2026-11-17T11:30:00.000Z',
        lastErrorAt: '2026-11-17T10:00:00.000Z',
        lastError: 'boom',
        nowMs
      })
    ).toBe('ok')
  })

  it('returns unknown with no history', () => {
    expect(deriveMarketingSyncHealthStatus({ nowMs })).toBe('unknown')
  })

  it('ignores stale errors outside the fresh window', () => {
    const staleErrorAt = new Date(nowMs - MARKETING_SYNC_ERROR_FRESH_MS - 1_000).toISOString()
    expect(
      deriveMarketingSyncHealthStatus({
        lastErrorAt: staleErrorAt,
        lastError: 'old boom',
        nowMs
      })
    ).toBe('unknown')
  })
})

describe('deriveMarketingSyncWorkerStatus', () => {
  const nowMs = Date.parse('2026-11-17T12:00:00.000Z')

  it('returns unknown without heartbeat', () => {
    expect(deriveMarketingSyncWorkerStatus(undefined, nowMs)).toBe('unknown')
  })

  it('returns ok for recent heartbeat', () => {
    expect(
      deriveMarketingSyncWorkerStatus(
        new Date(nowMs - MARKETING_SYNC_WORKER_STALE_MS + 1_000).toISOString(),
        nowMs
      )
    ).toBe('ok')
  })

  it('returns stale for old heartbeat', () => {
    expect(
      deriveMarketingSyncWorkerStatus(
        new Date(nowMs - MARKETING_SYNC_WORKER_STALE_MS - 1_000).toISOString(),
        nowMs
      )
    ).toBe('stale')
  })
})

describe('groupMarketingSyncRuns', () => {
  it('groups logs by syncId newest-first and derives status', () => {
    const runs = groupMarketingSyncRuns([
      log({
        id: '1',
        at: '2026-11-17T10:00:00.000Z',
        kind: 'progress',
        message: 'Sync started',
        syncId: 'sync-a',
        syncMode: 'full',
        chunkIndex: 1,
        chunkCount: 2
      }),
      log({
        id: '2',
        at: '2026-11-17T10:01:00.000Z',
        kind: 'success',
        message: 'Sync completed',
        syncId: 'sync-a',
        syncMode: 'full',
        syncedCount: 1000,
        chunkCount: 2
      }),
      log({
        id: '3',
        at: '2026-11-17T11:00:00.000Z',
        kind: 'progress',
        message: 'Sync started',
        syncId: 'sync-b',
        syncMode: 'delta'
      }),
      log({
        id: '4',
        at: '2026-11-17T09:00:00.000Z',
        kind: 'contact',
        message: 'ignored'
      })
    ])

    expect(runs).toHaveLength(2)
    expect(runs[0]?.syncId).toBe('sync-b')
    expect(runs[0]?.status).toBe('syncing')
    expect(runs[1]?.syncId).toBe('sync-a')
    expect(runs[1]?.status).toBe('ok')
    expect(runs[1]?.syncedCount).toBe(1000)
    expect(runs[1]?.eventCount).toBe(2)
  })

  it('marks failed runs from error events', () => {
    const runs = groupMarketingSyncRuns([
      log({
        id: '1',
        at: '2026-11-17T10:00:00.000Z',
        kind: 'progress',
        message: 'Sync started',
        syncId: 'sync-fail',
        level: 'info'
      }),
      log({
        id: '2',
        at: '2026-11-17T10:02:00.000Z',
        kind: 'error',
        message: 'boom',
        syncId: 'sync-fail',
        level: 'error'
      })
    ])
    expect(runs).toHaveLength(1)
    expect(runs[0]?.status).toBe('error')
    expect(runs[0]?.lastMessage).toBe('boom')
  })
})
