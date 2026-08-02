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
import type { BrevoSmtpDailyRow } from '~/types/brevoSmtpStats'
import { buildBrevoSmtpDailyChartOption } from '~/utils/brevoSmtpDailyChart'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent])

const props = withDefaults(
  defineProps<{
    daily: BrevoSmtpDailyRow[]
    loading?: boolean
  }>(),
  { loading: false }
)

const chartOption = computed(() => buildBrevoSmtpDailyChartOption(props.daily))

const hasChartData = computed(() =>
  props.daily.some(
    (row) =>
      row.requests > 0 ||
      row.delivered > 0 ||
      row.opens > 0 ||
      row.uniqueOpens > 0 ||
      row.uniqueClicks > 0 ||
      row.hardBounces + row.softBounces > 0
  )
)
</script>

<template>
  <div
    class="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm shadow-zinc-950/[0.04]"
    :aria-busy="loading"
    aria-label="Daily statistics chart"
  >
    <div class="border-b border-zinc-100 px-4 py-3.5 sm:px-6 sm:py-4">
      <h2 class="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Daily activity
      </h2>
      <p class="mt-1 text-sm text-zinc-500">
        Sent, delivered, opens, clicks, and bounces by day.
      </p>
    </div>

    <div class="px-1 py-3 sm:px-4 sm:py-5">
      <TenantChartSkeleton v-if="loading" />
      <ClientOnly v-else>
        <VChart
          v-if="hasChartData"
          class="h-56 w-full min-h-[14rem] sm:h-72 sm:min-h-[18rem]"
          :option="chartOption"
          autoresize
        />
        <div
          v-else
          class="flex h-56 items-center justify-center px-4 text-center text-sm text-zinc-500 sm:h-72"
        >
          No daily statistics for this date range yet.
        </div>
      </ClientOnly>
    </div>
  </div>
</template>
