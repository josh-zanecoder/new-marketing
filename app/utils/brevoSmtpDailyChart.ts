import type { ComposeOption } from 'echarts/core'
import type { LineSeriesOption } from 'echarts/charts'
import type {
  GridComponentOption,
  LegendComponentOption,
  TooltipComponentOption
} from 'echarts/components'
import type { BrevoSmtpDailyRow } from '~/types/brevoSmtpStats'
import {
  inputYmdToStartMs,
  toYmdLocal,
  type BrevoTrackingDateRange
} from '~/composables/useBrevoTrackingDateRange'

export type BrevoSmtpDailyChartOption = ComposeOption<
  LineSeriesOption | GridComponentOption | TooltipComponentOption | LegendComponentOption
>

function formatAxisLabel(ymd: string): string {
  const ms = inputYmdToStartMs(ymd)
  if (ms == null) return ymd
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function enumerateDays(fromYmd: string, toYmd: string): string[] {
  const fromMs = inputYmdToStartMs(fromYmd)
  const toMs = inputYmdToStartMs(toYmd)
  if (fromMs == null || toMs == null || fromMs > toMs) return []

  const out: string[] = []
  const cursor = new Date(fromMs)
  const end = new Date(toMs)
  while (cursor.getTime() <= end.getTime()) {
    out.push(toYmdLocal(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

function emptyDailyRow(date: string): BrevoSmtpDailyRow {
  return {
    date,
    requests: 0,
    delivered: 0,
    hardBounces: 0,
    softBounces: 0,
    opens: 0,
    uniqueOpens: 0,
    clicks: 0,
    uniqueClicks: 0,
    blocked: 0,
    invalid: 0,
    spamReports: 0,
    unsubscribed: 0
  }
}

/**
 * Brevo daily SMTP reports omit zero-activity days. Pad the selected range so the
 * chart x-axis matches Metrics/Logs (e.g. Last 7 Days), not only "today".
 */
export function fillBrevoSmtpDailyRange(
  daily: BrevoSmtpDailyRow[],
  range: BrevoTrackingDateRange | null | undefined
): BrevoSmtpDailyRow[] {
  const byDate = new Map(daily.map((row) => [row.date, row]))

  const from = range?.from?.trim() || null
  const to = range?.to?.trim() || null
  if (from && to) {
    return enumerateDays(from, to).map((ymd) => byDate.get(ymd) ?? emptyDailyRow(ymd))
  }

  if (daily.length === 0) return []
  const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date))
  return enumerateDays(sorted[0].date, sorted[sorted.length - 1].date).map(
    (ymd) => byDate.get(ymd) ?? emptyDailyRow(ymd)
  )
}

const SERIES: Array<{
  key: keyof BrevoSmtpDailyRow | 'bounced'
  label: string
  color: string
}> = [
  { key: 'requests', label: 'Sent', color: '#9333ea' },
  { key: 'delivered', label: 'Delivered', color: '#38bdf8' },
  { key: 'opens', label: 'Estimated openers', color: '#0f766e' },
  { key: 'uniqueOpens', label: 'Trackable openers', color: '#22c55e' },
  { key: 'uniqueClicks', label: 'Unique clickers', color: '#eab308' },
  { key: 'bounced', label: 'Bounced', color: '#ef4444' }
]

export function buildBrevoSmtpDailyChartOption(
  daily: BrevoSmtpDailyRow[],
  range?: BrevoTrackingDateRange | null
): BrevoSmtpDailyChartOption {
  const rows = fillBrevoSmtpDailyRange(daily, range)
  const labels = rows.map((r) => r.date)
  const axisLabels = labels.map(formatAxisLabel)

  return {
    color: SERIES.map((s) => s.color),
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line' }
    },
    legend: {
      type: 'scroll',
      top: 0,
      left: 0,
      right: 0,
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: '#52525b', fontSize: 11 }
    },
    grid: {
      left: 8,
      right: 12,
      top: 36,
      bottom: 8,
      outerBoundsMode: 'same',
      outerBoundsContain: 'axisLabel'
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: axisLabels,
      axisLabel: { color: '#71717a', fontSize: 11, hideOverlap: true },
      axisLine: { lineStyle: { color: '#e4e4e7' } },
      splitLine: { show: true, lineStyle: { color: 'rgba(148, 163, 184, 0.25)' } }
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { color: '#71717a', fontSize: 11 },
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.25)' } }
    },
    series: SERIES.map((s) => ({
      name: s.label,
      type: 'line' as const,
      smooth: 0.25,
      showSymbol: labels.length <= 14,
      symbolSize: 6,
      lineStyle: { width: 2, color: s.color },
      itemStyle: { color: s.color },
      data: rows.map((row) =>
        s.key === 'bounced' ? row.hardBounces + row.softBounces : Number(row[s.key] ?? 0)
      )
    }))
  }
}
