import type { ComposeOption } from 'echarts/core'
import type { LineSeriesOption } from 'echarts/charts'
import type {
  GridComponentOption,
  LegendComponentOption,
  TooltipComponentOption
} from 'echarts/components'
import type { BrevoTrackingDateRange } from '~/composables/useBrevoTrackingDateRange'
import {
  inputYmdToStartMs,
  isoMatchesBrevoTrackingRange,
  toYmdLocal
} from '~/composables/useBrevoTrackingDateRange'

export type BrevoTrackingChartOption = ComposeOption<
  LineSeriesOption | GridComponentOption | TooltipComponentOption | LegendComponentOption
>

export interface BrevoTrackingChartEvent {
  date?: string
  event?: string
}

const EVENT_COLORS: Record<string, string> = {
  delivered: '#059669',
  requests: '#0284c7',
  sent: '#0284c7',
  unique_opened: '#7c3aed',
  opened: '#7c3aed',
  clicks: '#d97706',
  click: '#d97706',
  hard_bounces: '#dc2626',
  soft_bounces: '#f97316',
  bounce: '#dc2626'
}

function eventColor(eventType: string): string {
  const key = eventType.toLowerCase()
  if (EVENT_COLORS[key]) return EVENT_COLORS[key]
  if (key.includes('open')) return EVENT_COLORS.opened
  if (key.includes('click')) return EVENT_COLORS.clicks
  if (key.includes('bounce')) return EVENT_COLORS.bounce
  return '#52525b'
}

function parseEventYmd(iso: string | undefined): string | null {
  if (!iso?.trim()) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return toYmdLocal(d)
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

function resolveChartDayLabels(
  events: BrevoTrackingChartEvent[],
  range: BrevoTrackingDateRange
): string[] {
  if (range.from && range.to) {
    return enumerateDays(range.from, range.to)
  }

  const days = new Set<string>()
  for (const ev of events) {
    const ymd = parseEventYmd(ev.date)
    if (ymd) days.add(ymd)
  }

  const sorted = [...days].sort()
  if (sorted.length <= 1) return sorted

  return enumerateDays(sorted[0], sorted[sorted.length - 1])
}

function formatAxisLabel(ymd: string): string {
  const ms = inputYmdToStartMs(ymd)
  if (ms == null) return ymd
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function buildBrevoTrackingChartOption(
  events: BrevoTrackingChartEvent[],
  range: BrevoTrackingDateRange,
  selectedEventTypes: string[]
): BrevoTrackingChartOption {
  const filtered = events.filter((ev) => {
    if (!isoMatchesBrevoTrackingRange(ev.date, range)) return false
    const type = (ev.event || '').trim()
    if (!type) return false
    if (selectedEventTypes.length && !selectedEventTypes.includes(type)) return false
    return true
  })

  const labels = resolveChartDayLabels(filtered, range)
  const dayIndex = new Map(labels.map((d, i) => [d, i]))

  const seriesTypes =
    selectedEventTypes.length > 0
      ? [...selectedEventTypes]
      : [...new Set(filtered.map((e) => (e.event || '').trim()).filter(Boolean))].sort((a, b) =>
          a.localeCompare(b)
        )

  const countsByType = new Map<string, number[]>()
  for (const type of seriesTypes) {
    countsByType.set(type, new Array(labels.length).fill(0))
  }

  for (const ev of filtered) {
    const type = (ev.event || '').trim()
    const ymd = parseEventYmd(ev.date)
    if (!type || !ymd) continue
    const idx = dayIndex.get(ymd)
    const bucket = countsByType.get(type)
    if (idx == null || !bucket) continue
    bucket[idx] += 1
  }

  const series: LineSeriesOption[] =
    seriesTypes.length > 0
      ? seriesTypes.map((type) => ({
          name: type,
          type: 'line',
          smooth: true,
          showSymbol: labels.length <= 31,
          symbolSize: 6,
          lineStyle: { width: 2 },
          itemStyle: { color: eventColor(type) },
          data: countsByType.get(type) ?? []
        }))
      : [
          {
            name: 'Events',
            type: 'line',
            smooth: true,
            showSymbol: labels.length <= 31,
            symbolSize: 6,
            lineStyle: { width: 2 },
            itemStyle: { color: '#18181b' },
            data: new Array(labels.length).fill(0)
          }
        ]

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line' }
    },
    legend: {
      show: series.length > 1,
      bottom: 0,
      type: 'scroll'
    },
    grid: {
      left: 12,
      right: 16,
      top: 16,
      bottom: series.length > 1 ? 48 : 16,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: labels.map(formatAxisLabel),
      axisLine: { lineStyle: { color: '#e4e4e7' } },
      axisLabel: { color: '#71717a', fontSize: 11 }
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: '#f4f4f5' } },
      axisLabel: { color: '#71717a', fontSize: 11 }
    },
    series
  }
}
