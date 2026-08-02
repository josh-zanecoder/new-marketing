import type { ComposeOption } from 'echarts/core'
import type { LineSeriesOption } from 'echarts/charts'
import type {
  GridComponentOption,
  LegendComponentOption,
  TooltipComponentOption
} from 'echarts/components'
import type { BrevoSmtpDailyRow } from '~/types/brevoSmtpStats'
import { inputYmdToStartMs } from '~/composables/useBrevoTrackingDateRange'

export type BrevoSmtpDailyChartOption = ComposeOption<
  LineSeriesOption | GridComponentOption | TooltipComponentOption | LegendComponentOption
>

function formatAxisLabel(ymd: string): string {
  const ms = inputYmdToStartMs(ymd)
  if (ms == null) return ymd
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
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
  daily: BrevoSmtpDailyRow[]
): BrevoSmtpDailyChartOption {
  const labels = daily.map((r) => r.date)
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
      containLabel: true
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
      data: daily.map((row) =>
        s.key === 'bounced' ? row.hardBounces + row.softBounces : Number(row[s.key] ?? 0)
      )
    }))
  }
}
