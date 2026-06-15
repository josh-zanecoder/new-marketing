<script setup lang="ts">
import type { CampaignTrackingSummary, CampaignTrackingTimeseriesPoint } from '~/types/campaignTracking'

const props = withDefaults(
  defineProps<{
    /** When omitted, aggregates Brevo webhook metrics across all accessible campaigns. */
    campaignId?: string
  }>(),
  {
    campaignId: undefined
  }
)

const TIMESERIES_DAY_OPTIONS = [7, 14, 30] as const
type TimeseriesDays = (typeof TIMESERIES_DAY_OPTIONS)[number]

const selectedDays = ref<TimeseriesDays>(14)

const scopeKey = computed(() => props.campaignId?.trim() || 'workspace')
const summaryKey = computed(() => `campaign-tracking-summary-${scopeKey.value}`)
const timeseriesKey = computed(() =>
  `campaign-tracking-timeseries-${scopeKey.value}-${selectedDays.value}`
)

const summaryQuery = computed(() => {
  const id = props.campaignId?.trim()
  return id ? { campaignId: id } : {}
})

const timeseriesQuery = computed(() => {
  const id = props.campaignId?.trim()
  return id
    ? { campaignId: id, days: selectedDays.value }
    : { days: selectedDays.value }
})

const { data: summaryData, pending: summaryPending } = useFetch<CampaignTrackingSummary>(
  '/api/v1/tracking/summary',
  {
    query: summaryQuery,
    key: summaryKey
  }
)

const { data: timeseriesData, pending: timeseriesPending } = useFetch<{
  points: CampaignTrackingTimeseriesPoint[]
}>(
  '/api/v1/tracking/timeseries',
  {
    query: timeseriesQuery,
    key: timeseriesKey
  }
)

const summary = computed(() => summaryData.value)
const timeseries = computed(() => timeseriesData.value?.points ?? [])

const scopeLabel = computed(() =>
  props.campaignId?.trim() ? 'This campaign' : 'All campaigns in this workspace'
)

const maxTimeseriesTotal = computed(() => {
  let max = 1
  for (const p of timeseries.value) {
    const total = p.delivered + p.opened + p.clicked + p.bounced + p.other
    if (total > max) max = total
  }
  return max
})

const eventBreakdown = computed(() => {
  const totals = summary.value?.totals
  if (!totals) return []
  return [
    { key: 'sent', label: 'Sent', count: totals.sent, color: 'bg-slate-500' },
    { key: 'delivered', label: 'Delivered', count: totals.delivered, color: 'bg-emerald-500' },
    { key: 'opened', label: 'Opened', count: totals.opened, color: 'bg-sky-500' },
    { key: 'clicked', label: 'Clicked', count: totals.clicked, color: 'bg-indigo-500' },
    { key: 'bounced', label: 'Bounced', count: totals.bounced, color: 'bg-rose-500' },
    { key: 'complained', label: 'Complaints', count: totals.complained, color: 'bg-orange-500' },
    { key: 'unsubscribed', label: 'Unsubscribed', count: totals.unsubscribed, color: 'bg-amber-500' }
  ].filter((row) => row.count > 0)
})

const breakdownMax = computed(() =>
  Math.max(1, ...eventBreakdown.value.map((row) => row.count))
)

function barWidth(count: number, max: number): string {
  if (!count || !max) return '0%'
  return `${Math.max(4, Math.round((count / max) * 100))}%`
}

function formatRate(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return `${value}%`
}

function formatDayLabel(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return date.slice(5)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
</script>

<template>
  <div class="space-y-6">
    <div
      v-if="summaryPending && !summary"
      class="animate-pulse rounded-2xl border border-slate-200/80 bg-white p-6"
      aria-busy="true"
    >
      <div class="h-4 w-48 rounded bg-slate-200/90" />
      <div class="mt-2 h-3 w-72 max-w-full rounded bg-slate-100" />
      <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div v-for="n in 4" :key="n" class="h-20 rounded-xl bg-slate-100" />
      </div>
      <div class="mt-6 h-40 rounded-xl bg-slate-100" />
    </div>

    <template v-else-if="summary">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-sm font-semibold text-slate-900">
            Brevo campaign analytics
          </h2>
          <p class="mt-1 text-xs text-slate-500">
            {{ scopeLabel }} · unique recipients per event type from Brevo transactional webhooks.
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
          {{ summary.source === 'webhook' ? 'Brevo webhook feed' : 'No Brevo events yet' }}
        </span>
      </div>

      <div
        v-if="summary.source === 'empty'"
        class="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-5 py-8 text-center text-sm text-slate-500"
      >
        No Brevo webhook events yet. Send a campaign and confirm your Brevo transactional webhook
        endpoint is configured for this workspace.
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

        <div
          v-if="summary.totals.bounced || summary.totals.complained || summary.totals.unsubscribed"
          class="grid gap-3 sm:grid-cols-3"
        >
          <div
            v-if="summary.totals.bounced"
            class="rounded-2xl border border-rose-200/70 bg-rose-50/40 px-4 py-4 shadow-sm"
          >
            <div class="text-xl font-bold tabular-nums text-rose-700">{{ summary.totals.bounced }}</div>
            <div class="mt-1 text-xs font-semibold uppercase tracking-wide text-rose-700">Bounced</div>
          </div>
          <div
            v-if="summary.totals.complained"
            class="rounded-2xl border border-orange-200/70 bg-orange-50/40 px-4 py-4 shadow-sm"
          >
            <div class="text-xl font-bold tabular-nums text-orange-700">{{ summary.totals.complained }}</div>
            <div class="mt-1 text-xs font-semibold uppercase tracking-wide text-orange-700">Complaints</div>
          </div>
          <div
            v-if="summary.totals.unsubscribed"
            class="rounded-2xl border border-amber-200/70 bg-amber-50/40 px-4 py-4 shadow-sm"
          >
            <div class="text-xl font-bold tabular-nums text-amber-800">{{ summary.totals.unsubscribed }}</div>
            <div class="mt-1 text-xs font-semibold uppercase tracking-wide text-amber-800">Unsubscribed</div>
          </div>
        </div>

        <div class="grid gap-6 lg:grid-cols-2">
          <div class="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
            <h3 class="text-sm font-semibold text-slate-900">Engagement funnel</h3>
            <p class="mt-1 text-xs text-slate-500">Conversion between send stages.</p>
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
                    :style="{
                      width:
                        step.pct != null
                          ? `${Math.min(100, step.pct)}%`
                          : barWidth(step.count, summary.funnel[0]?.count || 1)
                    }"
                  />
                </div>
              </li>
            </ul>
          </div>

          <div
            v-if="eventBreakdown.length"
            class="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6"
          >
            <h3 class="text-sm font-semibold text-slate-900">Event breakdown</h3>
            <p class="mt-1 text-xs text-slate-500">Unique recipients by Brevo event type.</p>
            <ul class="mt-4 space-y-3">
              <li v-for="row in eventBreakdown" :key="row.key" class="space-y-1.5">
                <div class="flex items-center justify-between gap-3 text-sm">
                  <span class="font-medium text-slate-800">{{ row.label }}</span>
                  <span class="tabular-nums text-slate-600">{{ row.count.toLocaleString() }}</span>
                </div>
                <div class="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    class="h-full rounded-full transition-all"
                    :class="row.color"
                    :style="{ width: barWidth(row.count, breakdownMax) }"
                  />
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div class="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 class="text-sm font-semibold text-slate-900">Activity over time</h3>
              <p class="mt-1 text-xs text-slate-500">
                Daily Brevo webhook event volume (stacked by type).
              </p>
            </div>
            <div
              class="inline-flex rounded-xl border border-slate-200/90 bg-slate-50/80 p-0.5"
              role="group"
              aria-label="Chart date range"
            >
              <button
                v-for="days in TIMESERIES_DAY_OPTIONS"
                :key="days"
                type="button"
                class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                :class="
                  selectedDays === days
                    ? 'bg-white text-indigo-900 shadow-sm ring-1 ring-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                "
                @click="selectedDays = days"
              >
                {{ days }}d
              </button>
            </div>
          </div>

          <p v-if="timeseriesPending" class="mt-3 text-xs text-slate-500">Refreshing chart…</p>

          <div
            class="mt-4 flex items-end gap-1.5 overflow-x-auto pb-2 sm:gap-2"
            :aria-label="`Activity chart for the last ${selectedDays} days`"
          >
            <div
              v-for="point in timeseries"
              :key="point.date"
              class="flex min-w-[2.25rem] flex-col items-center gap-2 sm:min-w-[2.75rem]"
            >
              <div
                class="flex h-32 w-7 flex-col justify-end gap-px sm:h-36 sm:w-8"
                :title="`${formatDayLabel(point.date)}: ${point.delivered} delivered, ${point.opened} opened, ${point.clicked} clicked, ${point.bounced} bounced`"
              >
                <div
                  class="w-full rounded-sm bg-rose-400"
                  :style="{ height: barWidth(point.bounced, maxTimeseriesTotal) }"
                />
                <div
                  class="w-full rounded-sm bg-indigo-500"
                  :style="{ height: barWidth(point.clicked, maxTimeseriesTotal) }"
                />
                <div
                  class="w-full rounded-sm bg-sky-400"
                  :style="{ height: barWidth(point.opened, maxTimeseriesTotal) }"
                />
                <div
                  class="w-full rounded-sm bg-emerald-400"
                  :style="{ height: barWidth(point.delivered, maxTimeseriesTotal) }"
                />
              </div>
              <span class="text-[10px] font-medium tabular-nums text-slate-500">
                {{ formatDayLabel(point.date) }}
              </span>
            </div>
          </div>

          <div class="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">
            <span class="inline-flex items-center gap-1.5">
              <span class="h-2.5 w-2.5 rounded-sm bg-emerald-400" /> Delivered
            </span>
            <span class="inline-flex items-center gap-1.5">
              <span class="h-2.5 w-2.5 rounded-sm bg-sky-400" /> Opened
            </span>
            <span class="inline-flex items-center gap-1.5">
              <span class="h-2.5 w-2.5 rounded-sm bg-indigo-500" /> Clicked
            </span>
            <span class="inline-flex items-center gap-1.5">
              <span class="h-2.5 w-2.5 rounded-sm bg-rose-400" /> Bounced
            </span>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>
