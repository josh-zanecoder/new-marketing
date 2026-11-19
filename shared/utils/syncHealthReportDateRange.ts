/**
 * Date-range helpers for the Sync Health Generate Report dialog.
 * Report range is independent of the board date filter.
 */

import {
  formatBrevoTrackingDateRangeLabel,
  isoMatchesBrevoTrackingRange,
  type BrevoTrackingDatePresetId,
  type BrevoTrackingDateRange
} from '../../app/composables/useBrevoTrackingDateRange'
import type { MarketingSyncDlqEntry, MarketingSyncHealthLog } from '../marketingSyncHealth'

/** YYYY-MM-DD parse as local calendar day (noon avoids DST edge cases). */
function ymdToLocalMs(ymd: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day, 12, 0, 0, 0).getTime()
}

/** True when custom from/to are empty, or both set with from <= to. */
export function isValidSyncHealthReportCustomRange(fromYmd: string, toYmd: string): boolean {
  const from = fromYmd.trim()
  const to = toYmd.trim()
  if (!from && !to) return true
  if (!from || !to) return false
  const fromMs = ymdToLocalMs(from)
  const toMs = ymdToLocalMs(to)
  if (fromMs == null || toMs == null) return false
  return fromMs <= toMs
}

export function syncHealthReportDateLabel(input: {
  preset: BrevoTrackingDatePresetId
  customFrom: string
  customTo: string
}): string {
  if (input.preset === 'all') return 'All time'
  if (input.preset === 'custom') {
    if (input.customFrom.trim() && input.customTo.trim()) {
      return formatBrevoTrackingDateRangeLabel('custom', input.customFrom, input.customTo)
    }
    return 'Custom range'
  }
  return formatBrevoTrackingDateRangeLabel(input.preset, input.customFrom, input.customTo)
}

export function filterSyncHealthReportEvents(
  logs: MarketingSyncHealthLog[] | null | undefined,
  selectedDbNames: ReadonlySet<string>,
  range: BrevoTrackingDateRange
): MarketingSyncHealthLog[] {
  return (logs ?? []).filter((log) => {
    if (log.dbName && !selectedDbNames.has(log.dbName)) return false
    return isoMatchesBrevoTrackingRange(log.at, range)
  })
}

export function filterSyncHealthReportDlq(
  rows: MarketingSyncDlqEntry[] | null | undefined,
  selectedDbNames: ReadonlySet<string>,
  range: BrevoTrackingDateRange
): MarketingSyncDlqEntry[] {
  return (rows ?? []).filter((row) => {
    if (row.dbName && !selectedDbNames.has(row.dbName)) return false
    return isoMatchesBrevoTrackingRange(row.at, range)
  })
}
