<script setup lang="ts">
import type { CampaignTrackingSummary, CampaignTrackingTimeseriesPoint } from '~/types/campaignTracking'

const props = defineProps<{
  campaignId: string
}>()

const summaryKey = computed(() => `campaign-tracking-summary-${props.campaignId}`)
const timeseriesKey = computed(() => `campaign-tracking-timeseries-${props.campaignId}`)

const { data: summaryData, pending: summaryPending } = useFetch<CampaignTrackingSummary>(
  '/api/v1/tracking/summary',
  {
    query: computed(() => ({ campaignId: props.campaignId })),
    key: summaryKey
  }
)

const { data: timeseriesData, pending: timeseriesPending } = useFetch<{
  points: CampaignTrackingTimeseriesPoint[]
}>(
  '/api/v1/tracking/timeseries',
  {
    query: computed(() => ({ campaignId: props.campaignId, days: 14 })),
    key: timeseriesKey
  }
)

const summary = computed(() => summaryData.value)
const timeseries = computed(() => timeseriesData.value?.points ?? [])

const maxTimeseriesTotal = computed(() => {
  let max = 1
  for (const p of timeseries.value) {
    const total = p.delivered + p.opened + p.clicked + p.bounced + p.other
    if (total > max) max = total
  }
  return max
})

function barWidth(count: number, max: number): string {
  if (!count || !max) return '0%'
  return `${Math.max(4, Math.round((count / max) * 100))}%`
}

function formatRate(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return `${value}%`
}
</script>

<template>
  <div class="space-y-6">
    <div
      v-if="summaryPending && !summary"
      class="animate-pulse rounded-2xl border border-slate-200/80 bg-white p-6"
      aria-busy="true"
    >
      <div class="h-4 w-40 rounded bg-slate-200/90" />
      <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div v-for="n in 4" :key="n" class="h-20 rounded-xl bg-slate-100" />
      </div>
    </div>

    <template v-else-if="summary">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 class="text-sm font-semibold text-slate-900">
            Engagement
          </h2>
          <p class="mt-1 text-xs text-slate-500">
            Unique recipients per event type from webhooks.
          </p>
        </div>
        <span
          class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset"
          :class="
            summary.source === 'webhook'
              ? 'bg-emerald-50 text-emerald-800 ring-emerald-200/70'
              : 'bg-slate-100 text-slate-700 ring-slate-200/70'
          "
        >
          {{ summary.source === 'webhook' ? 'Webhook feed' : 'No webhook events yet' }}
        </span>
      </div>

      <div
        v-if="summary.source === 'empty'"
        class="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-5 py-8 text-center text-sm text-slate-500"
      >
        No webhook events for this campaign yet. Send the campaign and confirm your webhook endpoint is configured.
      </div>

      <template v-else>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div class="rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm">
            <div class="text-2xl font-bold tabular-nums text-slate-900">{{ summary.totals.sent }}</div>
            <div class="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Sent</div>
          </div>
          <div class="rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm">
            <div class="text-2xl font-bold tabular-nums text-emerald-700">{{ summary.totals.delivered }}</div>
            <div class="mt-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">Delivered</div>
            <div class="mt-2 text-xs text-slate-500">{{ formatRate(summary.rates.deliveryRate) }} delivery rate</div>
          </div>
          <div class="rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm">
            <div class="text-2xl font-bold tabular-nums text-sky-700">{{ summary.totals.opened }}</div>
            <div class="mt-1 text-xs font-semibold uppercase tracking-wide text-sky-700">Opened</div>
            <div class="mt-2 text-xs text-slate-500">{{ formatRate(summary.rates.openRate) }} open rate</div>
          </div>
          <div class="rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm">
            <div class="text-2xl font-bold tabular-nums text-indigo-700">{{ summary.totals.clicked }}</div>
            <div class="mt-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">Clicked</div>
            <div class="mt-2 text-xs text-slate-500">{{ formatRate(summary.rates.clickRate) }} click rate</div>
          </div>
        </div>

        <div class="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
          <h3 class="text-sm font-semibold text-slate-900">Funnel</h3>
          <ul class="mt-4 space-y-3">
            <li v-for="step in summary.funnel" :key="step.label" class="space-y-1.5">
              <div class="flex items-center justify-between gap-3 text-sm">
                <span class="font-medium text-slate-800">{{ step.label }}</span>
                <span class="tabular-nums text-slate-600">
                  {{ step.count.toLocaleString() }}
                  <span v-if="step.pct != null" class="text-slate-400">· {{ step.pct }}%</span>
                </span>
              </div>
              <div class="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  class="h-full rounded-full bg-indigo-500 transition-all"
                  :style="{ width: step.pct != null ? `${Math.min(100, step.pct)}%` : barWidth(step.count, summary.funnel[0]?.count || 1) }"
                />
              </div>
            </li>
          </ul>
        </div>

        <div
          v-if="timeseries.length"
          class="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6"
        >
          <h3 class="text-sm font-semibold text-slate-900">Activity (last 14 days)</h3>
          <p v-if="timeseriesPending" class="mt-2 text-xs text-slate-500">Refreshing chart…</p>
          <div class="mt-4 flex items-end gap-2 overflow-x-auto pb-2">
            <div
              v-for="point in timeseries"
              :key="point.date"
              class="flex min-w-[3rem] flex-col items-center gap-2"
            >
              <div class="flex h-28 w-8 flex-col justify-end gap-0.5">
                <div
                  class="w-full rounded-sm bg-emerald-400"
                  :style="{ height: barWidth(point.delivered, maxTimeseriesTotal) }"
                  :title="`${point.delivered} delivered`"
                />
                <div
                  class="w-full rounded-sm bg-sky-400"
                  :style="{ height: barWidth(point.opened, maxTimeseriesTotal) }"
                  :title="`${point.opened} opened`"
                />
                <div
                  class="w-full rounded-sm bg-indigo-500"
                  :style="{ height: barWidth(point.clicked, maxTimeseriesTotal) }"
                  :title="`${point.clicked} clicked`"
                />
              </div>
              <span class="text-[10px] font-medium tabular-nums text-slate-500">{{ point.date.slice(5) }}</span>
            </div>
          </div>
          <div class="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">
            <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-emerald-400" /> Delivered</span>
            <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-sky-400" /> Opened</span>
            <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-indigo-500" /> Clicked</span>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>
