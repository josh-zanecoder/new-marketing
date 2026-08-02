<script setup lang="ts">
import { useBrevoSmtpStatsDashboard } from '~/composables/useBrevoSmtpStatsDashboard'
import { useBrevoTrackingDateRange } from '~/composables/useBrevoTrackingDateRange'
import type { BrevoTransactionalStats } from '~/types/brevoSmtpStats'
import {
  brevoSmtpEventBadgeClass,
  formatBrevoSmtpEventLabel,
  formatBrevoSmtpEventTableDate
} from '~/utils/brevoSmtpEventFormat'

const props = defineProps<{
  campaignId: string
}>()

type TopView = 'metrics' | 'chart'

const EVENTS_PAGE_SIZE = 10
const eventsPage = ref(1)
const topView = ref<TopView>('metrics')

const {
  datePreset,
  customDateFrom,
  customDateTo,
  effectiveDateRange,
  dateRangeLabel
} = useBrevoTrackingDateRange()

watch(effectiveDateRange, () => {
  eventsPage.value = 1
})

const statsQuery = computed(() => {
  const q: Record<string, string> = {
    campaignId: props.campaignId.trim(),
    eventsLimit: String(EVENTS_PAGE_SIZE),
    eventsOffset: String((eventsPage.value - 1) * EVENTS_PAGE_SIZE)
  }
  const from = effectiveDateRange.value.from?.trim()
  const to = effectiveDateRange.value.to?.trim()
  if (from) q.from = from
  if (to) q.to = to
  return q
})

const { data, error, pending, refresh } = useFetch<{ stats: BrevoTransactionalStats }>(
  '/api/v1/tracking/stats',
  {
    query: statsQuery,
    key: computed(
      () => `campaign-smtp-stats-${props.campaignId.trim()}-${JSON.stringify(statsQuery.value)}`
    ),
    watch: [statsQuery]
  }
)

const stats = computed(() => data.value?.stats ?? null)
const {
  statsRangeTitleLong,
  totalEmailsSent,
  metricsGridCells
} = useBrevoSmtpStatsDashboard(stats)

const eventItems = computed(() => stats.value?.events.items ?? [])
const eventsHasMore = computed(() => stats.value?.events.hasMore === true)

function goEventsPage(page: number) {
  if (page < 1 || page === eventsPage.value) return
  if (page > eventsPage.value && !eventsHasMore.value) return
  eventsPage.value = page
}

const FILL_CLASS: Record<string, string> = {
  blue: 'bg-blue-500',
  teal: 'bg-teal-600',
  green: 'bg-green-500',
  amber: 'bg-amber-400',
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  brown: 'bg-amber-700',
  slate: 'bg-slate-500'
}

defineExpose({
  refresh: async () => {
    eventsPage.value = 1
    await refresh()
  },
  pending
})
</script>

<template>
  <div class="space-y-3 sm:space-y-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div
        class="inline-flex w-fit rounded-full border border-zinc-200/90 bg-zinc-100/80 p-0.5 shadow-sm shadow-zinc-950/[0.03]"
        role="tablist"
        aria-label="Statistics view"
      >
        <button
          type="button"
          role="tab"
          class="rounded-full px-3.5 py-1.5 text-sm font-medium transition"
          :class="
            topView === 'metrics'
              ? 'bg-white text-zinc-900 shadow-sm'
              : 'text-zinc-600 hover:text-zinc-900'
          "
          :aria-selected="topView === 'metrics'"
          @click="topView = 'metrics'"
        >
          Metrics
        </button>
        <button
          type="button"
          role="tab"
          class="rounded-full px-3.5 py-1.5 text-sm font-medium transition"
          :class="
            topView === 'chart'
              ? 'bg-white text-zinc-900 shadow-sm'
              : 'text-zinc-600 hover:text-zinc-900'
          "
          :aria-selected="topView === 'chart'"
          @click="topView = 'chart'"
        >
          Daily activity
        </button>
      </div>

      <TenantBrevoTrackingDateRangePicker
        v-model:preset="datePreset"
        v-model:custom-from="customDateFrom"
        v-model:custom-to="customDateTo"
        :label="dateRangeLabel"
        class="shrink-0"
      />
    </div>

    <p v-if="statsRangeTitleLong" class="text-xs text-zinc-500">
      {{ statsRangeTitleLong }}
    </p>

    <div
      v-if="error"
      class="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
      role="alert"
    >
      <span>{{ error.message || 'Failed to load statistics from Brevo.' }}</span>
    </div>

    <div
      v-if="topView === 'metrics'"
      class="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white px-5 py-5 shadow-sm shadow-zinc-950/[0.04] sm:px-6 sm:py-6"
      :aria-busy="pending"
    >
      <template v-if="pending && !stats">
        <div class="animate-pulse space-y-6">
          <div class="h-9 w-48 rounded bg-zinc-100" />
          <div class="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
            <div v-for="n in 8" :key="n" class="space-y-2">
              <div class="h-4 w-full rounded bg-zinc-100" />
              <div class="h-1.5 w-full rounded-full bg-zinc-100" />
            </div>
          </div>
        </div>
      </template>

      <template v-else-if="stats">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <p class="leading-none text-zinc-900">
            <span class="text-3xl font-bold tabular-nums tracking-tight sm:text-[2.15rem]">
              {{ totalEmailsSent.toLocaleString() }}
            </span>
            <span class="ml-1.5 text-base font-normal text-zinc-500 sm:text-lg">
              emails sent
            </span>
          </p>
          <a
            href="https://help.brevo.com/hc/en-us/categories/360000946719-Transactional"
            target="_blank"
            rel="noopener noreferrer"
            class="shrink-0 text-sm font-medium text-zinc-600 hover:text-zinc-900 hover:underline"
          >
            Explain these metrics
          </a>
        </div>

        <div
          class="mt-6 grid grid-cols-2 gap-x-5 gap-y-4 md:grid-cols-4 md:gap-x-8 md:gap-y-5"
        >
          <div
            v-for="(cell, idx) in metricsGridCells"
            :key="'gc-' + idx"
            class="min-w-0"
          >
            <div v-if="cell">
              <div class="flex items-baseline justify-between gap-2 text-sm">
                <span class="text-zinc-600">{{ cell.label }}</span>
                <span
                  v-if="cell.valueDisplay === 'count'"
                  class="font-semibold tabular-nums text-zinc-900"
                >
                  {{ cell.countValue ?? 0 }}
                </span>
                <span v-else class="font-semibold tabular-nums text-zinc-900">
                  {{ cell.pct.toFixed(2) }}%
                </span>
              </div>
              <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100" role="presentation">
                <div
                  class="h-full min-w-0 rounded-full transition-[width] duration-300 ease-out"
                  :class="FILL_CLASS[cell.variant] || 'bg-zinc-400'"
                  :style="{ width: Math.min(100, cell.pct) + '%' }"
                />
              </div>
            </div>
            <div v-else class="min-h-[3.25rem]" aria-hidden="true" />
          </div>
        </div>
      </template>

      <p v-else class="text-sm text-zinc-500">
        No statistics for this campaign in the selected date range.
      </p>
    </div>

    <TenantBrevoSmtpDailyChart
      v-else
      :daily="stats?.daily ?? []"
      :date-range="effectiveDateRange"
      :loading="pending && !stats"
    />

    <div
      class="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm shadow-zinc-950/[0.04]"
      :aria-busy="pending"
    >
      <div class="border-b border-zinc-100 px-4 py-3 sm:px-5">
        <p class="text-sm font-semibold text-zinc-800">Messages</p>
        <p class="mt-0.5 text-xs text-zinc-500">
          Latest Brevo events ({{ EVENTS_PAGE_SIZE }} per page)
        </p>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full min-w-[40rem] text-left text-sm">
          <thead>
            <tr class="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-500">
              <th class="px-4 py-3 font-semibold sm:px-5">Event</th>
              <th class="px-4 py-3 font-semibold sm:px-5">Date</th>
              <th class="px-4 py-3 font-semibold sm:px-5">Subject</th>
              <th class="px-4 py-3 font-semibold sm:px-5">From</th>
              <th class="px-4 py-3 font-semibold sm:px-5">To</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(ev, idx) in eventItems"
              :key="(ev.messageId || 'm') + (ev.date || '') + idx"
              class="border-t border-zinc-100 hover:bg-zinc-50/80"
            >
              <td class="whitespace-nowrap px-4 py-3 sm:px-5">
                <span
                  class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset"
                  :class="brevoSmtpEventBadgeClass(ev.event)"
                >
                  {{ formatBrevoSmtpEventLabel(ev.event) }}
                </span>
              </td>
              <td class="whitespace-nowrap px-4 py-3 tabular-nums text-zinc-700 sm:px-5">
                {{ formatBrevoSmtpEventTableDate(ev.date) }}
              </td>
              <td class="max-w-[14rem] truncate px-4 py-3 text-zinc-800 sm:px-5">
                {{ ev.subject || '—' }}
              </td>
              <td class="max-w-[12rem] truncate px-4 py-3 text-zinc-600 sm:px-5">
                {{ ev.from || '—' }}
              </td>
              <td class="max-w-[12rem] truncate px-4 py-3 text-zinc-600 sm:px-5">
                {{ ev.email || '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        v-if="pending && !eventItems.length"
        class="px-5 py-10 text-center text-sm text-zinc-500"
      >
        Loading events…
      </div>
      <div
        v-else-if="!eventItems.length"
        class="px-5 py-12 text-center text-sm text-zinc-500"
      >
        No events in this range.
      </div>
      <div
        v-else
        class="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 bg-zinc-50/60 px-4 py-3 text-sm text-zinc-600 sm:px-5"
      >
        <p>Page {{ eventsPage }}</p>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="h-8 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 disabled:opacity-40"
            :disabled="eventsPage <= 1 || pending"
            @click="goEventsPage(eventsPage - 1)"
          >
            Prev
          </button>
          <button
            type="button"
            class="h-8 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 disabled:opacity-40"
            :disabled="!eventsHasMore || pending"
            @click="goEventsPage(eventsPage + 1)"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
