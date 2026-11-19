import { describe, expect, it } from 'vitest'
import {
  filterSyncHealthReportDlq,
  filterSyncHealthReportEvents,
  isValidSyncHealthReportCustomRange,
  syncHealthReportDateLabel
} from '../syncHealthReportDateRange'
import type { MarketingSyncDlqEntry, MarketingSyncHealthLog } from '../../marketingSyncHealth'

describe('isValidSyncHealthReportCustomRange', () => {
  it('allows empty or ordered ranges', () => {
    expect(isValidSyncHealthReportCustomRange('', '')).toBe(true)
    expect(isValidSyncHealthReportCustomRange('2026-01-01', '2026-01-31')).toBe(true)
    expect(isValidSyncHealthReportCustomRange('2026-01-01', '2026-01-01')).toBe(true)
  })

  it('rejects inverted or partial custom ranges', () => {
    expect(isValidSyncHealthReportCustomRange('2026-02-01', '2026-01-01')).toBe(false)
    expect(isValidSyncHealthReportCustomRange('2026-01-01', '')).toBe(false)
    expect(isValidSyncHealthReportCustomRange('', '2026-01-01')).toBe(false)
  })
})

describe('syncHealthReportDateLabel', () => {
  it('labels all-time and custom spans', () => {
    expect(
      syncHealthReportDateLabel({ preset: 'all', customFrom: '', customTo: '' })
    ).toBe('All time')
    expect(
      syncHealthReportDateLabel({
        preset: 'custom',
        customFrom: '2026-01-01',
        customTo: '2026-01-15'
      })
    ).toMatch(/01\/01\/2026/)
  })
})

describe('filterSyncHealthReportEvents / Dlq', () => {
  const logs: MarketingSyncHealthLog[] = [
    {
      id: '1',
      at: '2026-01-10T12:00:00.000Z',
      level: 'info',
      kind: 'contact',
      message: 'a',
      dbName: 'acme_db'
    },
    {
      id: '2',
      at: '2026-02-10T12:00:00.000Z',
      level: 'info',
      kind: 'contact',
      message: 'b',
      dbName: 'acme_db'
    },
    {
      id: '3',
      at: '2026-01-12T12:00:00.000Z',
      level: 'info',
      kind: 'contact',
      message: 'c',
      dbName: 'other_db'
    }
  ]

  const dlq: MarketingSyncDlqEntry[] = [
    {
      id: 'd1',
      at: '2026-01-11T12:00:00.000Z',
      error: 'fail',
      dbName: 'acme_db'
    }
  ]

  it('filters by tenant selection and date range', () => {
    const selected = new Set(['acme_db'])
    const range = { from: '2026-01-01', to: '2026-01-31' }
    const events = filterSyncHealthReportEvents(logs, selected, range)
    expect(events.map((row) => row.id)).toEqual(['1'])
    const dead = filterSyncHealthReportDlq(dlq, selected, range)
    expect(dead.map((row) => row.id)).toEqual(['d1'])
  })

  it('includes all dates when range is unbounded (All time)', () => {
    const selected = new Set(['acme_db'])
    const events = filterSyncHealthReportEvents(logs, selected, { from: null, to: null })
    expect(events.map((row) => row.id)).toEqual(['1', '2'])
  })
})
