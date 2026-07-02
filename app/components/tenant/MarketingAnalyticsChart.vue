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
import type { MarketingAnalyticsTimeseriesPoint } from '~/types/marketingAnalytics'
import { buildMarketingAnalyticsChartOption } from '~/utils/marketingAnalyticsChart'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent])

const props = defineProps<{
  points: MarketingAnalyticsTimeseriesPoint[]
  dateRange?: BrevoTrackingDateRange
  loading?: boolean
}>()

const chartOption = computed(() =>
  buildMarketingAnalyticsChartOption(props.points, props.dateRange)
)

const hasChartData = computed(() =>
  props.points.some(
    (point) =>
      point.emailsSent > 0 ||
      point.emailsDelivered > 0 ||
      (point.openRate ?? 0) > 0 ||
      (point.clickRate ?? 0) > 0 ||
      (point.bounceRate ?? 0) > 0 ||
      (point.unsubscribeRate ?? 0) > 0
  )
)
</script>

<template>
  <section aria-label="Performance trend">
    <div class="mb-4">
      <h2 class="text-sm font-semibold text-zinc-900">
        Performance trend
      </h2>
      <p class="mt-0.5 text-xs text-zinc-500">
        Volume and engagement rates over time
      </p>
    </div>

    <div
      class="rounded-2xl border border-zinc-200/90 bg-white shadow-sm shadow-zinc-950/[0.04] ring-1 ring-zinc-900/[0.02]"
    >
      <div
        v-if="loading"
        class="flex h-56 items-center justify-center sm:h-96"
      >
        <div class="flex flex-col items-center gap-3">
          <div class="h-9 w-9 animate-spin rounded-full border-2 border-zinc-200 border-t-primary-600" />
          <p class="text-sm text-zinc-500">
            Loading chart…
          </p>
        </div>
      </div>

      <ClientOnly v-else>
        <div v-if="hasChartData" class="px-1 pb-3 pt-2 sm:px-4 sm:pb-5 sm:pt-4">
          <VChart
            class="h-56 w-full min-h-[14rem] sm:h-96 sm:min-h-[24rem]"
            :option="chartOption"
            autoresize
          />
        </div>
        <div
          v-else
          class="flex flex-col items-center px-4 py-12 text-center sm:px-6 sm:py-20"
        >
          <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-500">
            <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 3v18h18M7 16l4-4 4 4 6-8" />
            </svg>
          </div>
          <p class="mt-4 text-sm font-medium text-zinc-900">
            No analytics data for this range
          </p>
          <p class="mt-1 max-w-sm text-sm text-zinc-500">
            Try widening the date range or choosing a different campaign.
          </p>
        </div>
        <template #fallback>
          <div class="flex h-56 items-center justify-center text-sm text-zinc-500 sm:h-96">
            Loading chart…
          </div>
        </template>
      </ClientOnly>
    </div>
  </section>
</template>
