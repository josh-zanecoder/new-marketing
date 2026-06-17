<script setup lang="ts">
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  TooltipComponent
} from 'echarts/components'
import VChart from 'vue-echarts'
import type { BrevoTrackingDateRange } from '~/composables/useBrevoTrackingDateRange'
import {
  buildBrevoTrackingChartOption,
  type BrevoTrackingChartEvent
} from '~/utils/brevoTrackingChart'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent])

const props = defineProps<{
  events: BrevoTrackingChartEvent[]
  dateRange: BrevoTrackingDateRange
  selectedEventTypes: string[]
  cardClass?: string
}>()

const chartOption = computed(() =>
  buildBrevoTrackingChartOption(
    props.events,
    props.dateRange,
    props.selectedEventTypes
  )
)

const hasChartData = computed(() => {
  const opt = chartOption.value
  const series = opt.series
  if (!Array.isArray(series)) return false
  return series.some((s) => {
    const data = 'data' in s && Array.isArray(s.data) ? s.data : []
    return data.some((n) => typeof n === 'number' && n > 0)
  })
})
</script>

<template>
  <div
    :class="
      cardClass ||
      'overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm shadow-zinc-950/[0.04]'
    "
  >
    <div class="border-b border-zinc-100 px-5 py-4 sm:px-6">
      <h2 class="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Event activity
      </h2>
      <p class="mt-1 text-sm text-zinc-500">
        Daily event counts for the selected date range and event filters.
      </p>
    </div>

    <ClientOnly>
      <div v-if="hasChartData" class="px-2 py-4 sm:px-4 sm:py-5">
        <VChart
          class="h-72 w-full min-h-[18rem]"
          :option="chartOption"
          autoresize
        />
      </div>
      <div
        v-else
        class="flex flex-col items-center px-6 py-14 text-center sm:py-16"
      >
        <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400">
          <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 3v18h18M7 16l4-4 4 4 6-8" />
          </svg>
        </div>
        <p class="mt-4 text-sm font-medium text-zinc-900">
          No chart data for this range
        </p>
        <p class="mt-1 max-w-sm text-sm text-zinc-500">
          Adjust the date range or event filters to see activity over time.
        </p>
      </div>
      <template #fallback>
        <div class="flex h-72 items-center justify-center text-sm text-zinc-500">
          Loading chart…
        </div>
      </template>
    </ClientOnly>
  </div>
</template>
