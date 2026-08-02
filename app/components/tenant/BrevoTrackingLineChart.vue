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

const DEFAULT_CARD_CLASS =
  'overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm shadow-zinc-950/[0.04]'

const props = withDefaults(
  defineProps<{
    events: BrevoTrackingChartEvent[]
    dateRange: BrevoTrackingDateRange
    selectedEventTypes: string[]
    cardClass?: string
    loading?: boolean
    /** Tighter header / chart height for campaign Tracking. */
    compact?: boolean
  }>(),
  { loading: false, cardClass: DEFAULT_CARD_CLASS, compact: false }
)

const chartOption = computed(() =>
  buildBrevoTrackingChartOption(
    props.events,
    props.dateRange,
    props.selectedEventTypes
  )
)

const hasChartData = computed(() => {
  const series = chartOption.value.series
  if (!Array.isArray(series)) return false

  return series.some((s) => {
    const data = 'data' in s && Array.isArray(s.data) ? s.data : []
    return data.some((n) => typeof n === 'number' && n > 0)
  })
})
</script>

<template>
  <div
    :class="cardClass"
    :aria-busy="loading"
    aria-label="Event activity chart"
  >
    <div
      class="border-b border-zinc-100"
      :class="compact ? 'px-4 py-2.5 sm:px-5' : 'px-4 py-3 sm:px-6'"
    >
      <h2 class="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Event activity
      </h2>
      <p v-if="!compact" class="mt-0.5 text-sm text-zinc-500">
        Daily counts for the selected range and filters.
      </p>
    </div>

    <div :class="compact ? 'px-1 py-2 sm:px-4 sm:py-3' : 'px-1 py-3 sm:px-4 sm:py-4'">
      <TenantChartSkeleton v-if="loading" />

      <ClientOnly v-else>
        <VChart
          v-if="hasChartData"
          class="w-full"
          :class="
            compact
              ? 'h-52 min-h-[13rem] sm:h-60 sm:min-h-[15rem]'
              : 'h-56 min-h-[14rem] sm:h-72 sm:min-h-[18rem]'
          "
          :option="chartOption"
          autoresize
        />
        <div
          v-else
          class="flex flex-col items-center px-4 text-center sm:px-6"
          :class="compact ? 'py-8' : 'py-12 sm:py-14'"
        >
          <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 3v18h18M7 16l4-4 4 4 6-8" />
            </svg>
          </div>
          <p class="mt-4 text-sm font-medium text-zinc-900">
            No activity in this range
          </p>
          <p class="mt-1 max-w-sm text-sm text-zinc-500">
            Widen the date range or choose different event types.
          </p>
        </div>

        <template #fallback>
          <TenantChartSkeleton />
        </template>
      </ClientOnly>
    </div>
  </div>
</template>
