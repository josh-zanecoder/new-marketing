import type { ComposeOption } from 'echarts/core'
import type { LineSeriesOption } from 'echarts/charts'
import type {
  GridComponentOption,
  LegendComponentOption,
  TooltipComponentOption,
  YAXisComponentOption
} from 'echarts/components'
import type { MarketingAnalyticsTimeseriesPoint } from '~/types/marketingAnalytics'
import { inputYmdToStartMs } from '~/composables/useBrevoTrackingDateRange'

export type MarketingAnalyticsChartOption = ComposeOption<
  | LineSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
  | YAXisComponentOption
>

function formatAxisLabel(ymd: string): string {
  const ms = inputYmdToStartMs(ymd)
  if (ms == null) return ymd
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatPercent(value: number | null): string {
  if (value == null) return '—'
  return `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)}%`
}

export function buildMarketingAnalyticsChartOption(
  points: MarketingAnalyticsTimeseriesPoint[]
): MarketingAnalyticsChartOption {
  const labels = points.map((point) => formatAxisLabel(point.date))

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line' },
      formatter(items) {
        if (!Array.isArray(items) || items.length === 0) return ''
        const idx = items[0]?.dataIndex ?? 0
        const point = points[idx]
        if (!point) return ''
        const lines = [
          `<strong>${formatAxisLabel(point.date)}</strong>`,
          `Emails sent: ${point.emailsSent.toLocaleString()}`,
          `Emails delivered: ${point.emailsDelivered.toLocaleString()}`,
          `Open rate: ${formatPercent(point.openRate)}`,
          `Click rate: ${formatPercent(point.clickRate)}`,
          `Bounce rate: ${formatPercent(point.bounceRate)}`,
          `Unsubscribe rate: ${formatPercent(point.unsubscribeRate)}`
        ]
        return lines.join('<br/>')
      }
    },
    legend: {
      bottom: 4,
      type: 'scroll',
      itemGap: 16,
      textStyle: { color: '#52525b', fontSize: 11 }
    },
    grid: {
      left: 4,
      right: 4,
      top: 44,
      bottom: 64,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: labels,
      axisLine: { lineStyle: { color: '#e4e4e7' } },
      axisLabel: { color: '#71717a', fontSize: 11 }
    },
    yAxis: [
      {
        type: 'value',
        name: 'Emails',
        nameLocation: 'end',
        nameGap: 12,
        nameTextStyle: { color: '#71717a', fontSize: 11, align: 'left' },
        minInterval: 1,
        splitLine: { lineStyle: { color: '#f4f4f5' } },
        axisLabel: { color: '#71717a', fontSize: 11 }
      },
      {
        type: 'value',
        name: 'Rate %',
        nameLocation: 'end',
        nameGap: 12,
        nameTextStyle: { color: '#71717a', fontSize: 11, align: 'right' },
        min: 0,
        max: 100,
        splitLine: { show: false },
        axisLabel: {
          color: '#71717a',
          fontSize: 11,
          formatter: (value: number) => `${value}%`
        }
      }
    ],
    series: [
      {
        name: 'Emails sent',
        type: 'line',
        smooth: true,
        showSymbol: labels.length <= 31,
        symbolSize: 6,
        lineStyle: { width: 2 },
        itemStyle: { color: '#0284c7' },
        areaStyle: { color: 'rgba(2, 132, 199, 0.08)' },
        data: points.map((point) => point.emailsSent)
      },
      {
        name: 'Emails delivered',
        type: 'line',
        smooth: true,
        showSymbol: labels.length <= 31,
        symbolSize: 6,
        lineStyle: { width: 2 },
        itemStyle: { color: '#059669' },
        areaStyle: { color: 'rgba(5, 150, 105, 0.08)' },
        data: points.map((point) => point.emailsDelivered)
      },
      {
        name: 'Open rate',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        showSymbol: labels.length <= 31,
        symbolSize: 6,
        lineStyle: { width: 2 },
        itemStyle: { color: '#7c3aed' },
        data: points.map((point) => point.openRate ?? 0)
      },
      {
        name: 'Click rate',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        showSymbol: labels.length <= 31,
        symbolSize: 6,
        lineStyle: { width: 2 },
        itemStyle: { color: '#d97706' },
        data: points.map((point) => point.clickRate ?? 0)
      },
      {
        name: 'Bounce rate',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        showSymbol: labels.length <= 31,
        symbolSize: 6,
        lineStyle: { width: 2 },
        itemStyle: { color: '#dc2626' },
        data: points.map((point) => point.bounceRate ?? 0)
      },
      {
        name: 'Unsubscribe rate',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        showSymbol: labels.length <= 31,
        symbolSize: 6,
        lineStyle: { width: 2 },
        itemStyle: { color: '#52525b' },
        data: points.map((point) => point.unsubscribeRate ?? 0)
      }
    ]
  }
}

export function formatMarketingAnalyticsPercent(value: number | null | undefined): string {
  if (value == null) return '—'
  return `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)}%`
}

export function formatMarketingAnalyticsCount(value: number | undefined): string {
  return new Intl.NumberFormat().format(value ?? 0)
}

export function buildMarketingAnalyticsMetricCards(
  summary: import('~/types/marketingAnalytics').MarketingAnalyticsSummary | undefined
): import('~/types/marketingAnalytics').MarketingAnalyticsMetricCard[] {
  const deliveryRate =
    summary && summary.emailsSent > 0
      ? (summary.emailsDelivered / summary.emailsSent) * 100
      : null

  return [
    {
      id: 'sent',
      label: 'Emails sent',
      value: formatMarketingAnalyticsCount(summary?.emailsSent),
      hint: 'Total send requests in range',
      accentClass: 'text-sky-700',
      iconBgClass: 'bg-sky-100 text-sky-700',
      iconClass: 'text-sky-700',
      cardClass: 'border-sky-100/80 bg-gradient-to-br from-white to-sky-50/50'
    },
    {
      id: 'delivered',
      label: 'Emails delivered',
      value: formatMarketingAnalyticsCount(summary?.emailsDelivered),
      hint:
        deliveryRate != null
          ? `${formatMarketingAnalyticsPercent(deliveryRate)} delivery rate`
          : 'Successfully delivered messages',
      accentClass: 'text-emerald-700',
      iconBgClass: 'bg-emerald-100 text-emerald-700',
      iconClass: 'text-emerald-700',
      cardClass: 'border-emerald-100/80 bg-gradient-to-br from-white to-emerald-50/50'
    },
    {
      id: 'open-rate',
      label: 'Open rate',
      value: formatMarketingAnalyticsPercent(summary?.openRate),
      hint: summary ? `${formatMarketingAnalyticsCount(summary.uniqueOpens)} unique opens` : undefined,
      accentClass: 'text-violet-700',
      iconBgClass: 'bg-violet-100 text-violet-700',
      iconClass: 'text-violet-700',
      cardClass: 'border-violet-100/80 bg-gradient-to-br from-white to-violet-50/50'
    },
    {
      id: 'click-rate',
      label: 'Click rate',
      value: formatMarketingAnalyticsPercent(summary?.clickRate),
      hint: summary ? `${formatMarketingAnalyticsCount(summary.uniqueClicks)} unique clicks` : undefined,
      accentClass: 'text-amber-700',
      iconBgClass: 'bg-amber-100 text-amber-700',
      iconClass: 'text-amber-700',
      cardClass: 'border-amber-100/80 bg-gradient-to-br from-white to-amber-50/50'
    },
    {
      id: 'bounce-rate',
      label: 'Bounce rate',
      value: formatMarketingAnalyticsPercent(summary?.bounceRate),
      hint: summary ? `${formatMarketingAnalyticsCount(summary.bounces)} bounces` : undefined,
      accentClass: 'text-red-700',
      iconBgClass: 'bg-red-100 text-red-700',
      iconClass: 'text-red-700',
      cardClass: 'border-red-100/80 bg-gradient-to-br from-white to-red-50/50'
    },
    {
      id: 'unsubscribe-rate',
      label: 'Unsubscribe rate',
      value: formatMarketingAnalyticsPercent(summary?.unsubscribeRate),
      hint: summary ? `${formatMarketingAnalyticsCount(summary.unsubscribes)} unsubscribes` : undefined,
      accentClass: 'text-zinc-700',
      iconBgClass: 'bg-zinc-200/70 text-zinc-700',
      iconClass: 'text-zinc-700',
      cardClass: 'border-zinc-200/80 bg-gradient-to-br from-white to-zinc-50/80'
    }
  ]
}
