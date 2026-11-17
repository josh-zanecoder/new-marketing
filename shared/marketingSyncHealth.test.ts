import { describe, expect, it } from 'vitest'
import {
  deriveMarketingSyncHealthStatus,
  deriveMarketingSyncWorkerStatus,
  MARKETING_SYNC_ERROR_FRESH_MS,
  MARKETING_SYNC_WORKER_STALE_MS
} from './marketingSyncHealth'

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
