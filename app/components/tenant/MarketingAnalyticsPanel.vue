<script setup lang="ts">
import {
  BREVO_SMTP_STATS_DATE_PRESET_OPTIONS,
  useBrevoTrackingDateRange
} from '~/composables/useBrevoTrackingDateRange'
import type { MarketingAnalyticsPayload } from '~/types/marketingAnalytics'
import { buildMarketingAnalyticsMetricCards } from '~/utils/marketingAnalyticsChart'
import { formatBrevoSmtpEventLabel } from '~/utils/brevoSmtpEventFormat'

const EVENTS_PAGE_SIZE = 10

type TopView = 'metrics' | 'chart'

const EVENT_FILTER_TYPES = [
  'requests',
  'delivered',
  'opened',
  'clicks',
  'hardBounces',
  'softBounces',
  'deferred',
  'blocked',
  'invalid',
  'spam',
  'unsubscribed',
  'loadedByProxy',
  'error'
] as const

const selectedCampaignId = ref('')
const selectedUserEmail = ref('')
const selectedEventType = ref('')
const eventsPage = ref(1)
const topView = ref<TopView>('metrics')
const syncing = ref(false)

const { data: me } = useMarketingMe()

const {
  datePreset,
  customDateFrom,
  customDateTo,
  effectiveDateRange,
  dateRangeFilterActive,
  dateRangeLabel,
  resetDateRange
} = useBrevoTrackingDateRange()

const canFilterByUserTag = computed(() => {
  if (me.value?.authType === 'firebase') {
    return me.value.role === 'tenant'
  }
  if (me.value?.authType !== 'apiKey') return false
  if (me.value.tenantWideContacts === true) return true
  const owners = me.value.contactOwnerEmails?.length ?? 0
  return owners === 0 || owners > 1
})

watch([effectiveDateRange, selectedCampaignId, selectedUserEmail, selectedEventType], () => {
  eventsPage.value = 1
})

const analyticsQuery = computed(() => {
  const query: Record<string, string> = {
    eventsLimit: String(EVENTS_PAGE_SIZE),
    eventsOffset: String((eventsPage.value - 1) * EVENTS_PAGE_SIZE),
    tzOffset: String(new Date().getTimezoneOffset())
  }
  const range = effectiveDateRange.value
  if (range.from) query.from = range.from
  if (range.to) query.to = range.to
  const campaignId = selectedCampaignId.value.trim()
  if (campaignId) query.campaignId = campaignId
  if (canFilterByUserTag.value) {
    const userEmail = selectedUserEmail.value.trim().toLowerCase()
    if (userEmail) query.userEmail = userEmail
  }
  const eventType = selectedEventType.value.trim()
  if (eventType) query.event = eventType
  return query
})

const fetchKey = computed(
  () => `tenant-marketing-analytics-${JSON.stringify(analyticsQuery.value)}`
)

const { data, error, pending, refresh } = useFetch<{ analytics: MarketingAnalyticsPayload }>(
  '/api/v1/tracking/analytics',
  {
    query: analyticsQuery,
    key: fetchKey,
    watch: [analyticsQuery],
    getCachedData: (key, nuxtApp) =>
      nuxtApp.payload.data[key] ?? nuxtApp.static.data[key]
  }
)

const isLoading = computed(() => pending.value || syncing.value)

const { data: campaignsListData } = useTenantCampaignsList()

const analytics = computed(() => data.value?.analytics)
const metricCards = computed(() => buildMarketingAnalyticsMetricCards(analytics.value?.summary))
const timeseries = computed(() => analytics.value?.timeseries ?? [])
const eventItems = computed(() => analytics.value?.events?.items ?? [])
const eventsHasMore = computed(() => analytics.value?.events?.hasMore === true)
const eventTypeCounts = computed(() => analytics.value?.eventTypeCounts ?? {})

const eventFilterOptions = computed(() => {
  const counts = eventTypeCounts.value
  const selected = selectedEventType.value.trim()
  const types = EVENT_FILTER_TYPES.filter((t) => (counts[t] ?? 0) > 0 || t === selected)
  return [
    { value: '', label: 'All events' },
    ...types.map((t) => ({
      value: t,
      label: `${formatBrevoSmtpEventLabel(t)} (${counts[t] ?? 0})`
    }))
  ]
})

const messagesRangeTitle = computed(() => {
  const from = effectiveDateRange.value.from
  const to = effectiveDateRange.value.to
  if (!from || !to) return 'Latest events (10 per page)'
  const a = new Date(`${from}T12:00:00`)
  const b = new Date(`${to}T12:00:00`)
  const o: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' }
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) {
    return 'Latest events (10 per page)'
  }
  return `Messages from ${a.toLocaleDateString('en-US', o)} to ${b.toLocaleDateString('en-US', o)}`
})

const campaignOptions = computed(() => {
  const list = campaignsListData.value?.campaigns ?? []
  return [...list]
    .map((campaign) => ({
      id: campaign.id?.trim() || '',
      name: (campaign.name ?? '').trim() || campaign.id
    }))
    .filter((campaign) => campaign.id)
    .sort((a, b) => a.name.localeCompare(b.name))
})

const userFilterOptions = computed(() => {
  const users = analytics.value?.tagUsers ?? []
  const selected = selectedUserEmail.value.trim().toLowerCase()
  const emails = new Set(users.map((e) => e.trim().toLowerCase()).filter(Boolean))
  if (me.value?.authType === 'apiKey') {
    for (const e of me.value.contactOwnerEmails ?? []) {
      const t = e.trim().toLowerCase()
      if (t.includes('@')) emails.add(t)
    }
  }
  if (selected) emails.add(selected)
  return [
    { value: '', label: 'All users' },
    ...[...emails]
      .sort((a, b) => a.localeCompare(b))
      .map((email) => ({ value: email, label: email }))
  ]
})

const showUserFilter = computed(
  () => analytics.value?.allowUserTagFilter === true || canFilterByUserTag.value
)

const hasActiveFilters = computed(
  () =>
    dateRangeFilterActive.value ||
    !!selectedCampaignId.value.trim() ||
    !!selectedUserEmail.value.trim() ||
    !!selectedEventType.value.trim()
)

function clearAllFilters() {
  resetDateRange()
  selectedCampaignId.value = ''
  selectedUserEmail.value = ''
  selectedEventType.value = ''
  eventsPage.value = 1
}

/**
 * Pull Brevo unaggregated events into Mongo for the active range, then reload Analytics.
 */
async function refreshFromBrevo() {
  if (syncing.value) return
  syncing.value = true
  eventsPage.value = 1
  try {
    const body: Record<string, string> = {}
    const from = effectiveDateRange.value.from?.trim()
    const to = effectiveDateRange.value.to?.trim()
    if (from) body.from = from
    if (to) body.to = to
    const campaignId = selectedCampaignId.value.trim()
    if (campaignId) body.campaignId = campaignId

    await $fetch('/api/v1/tracking/sync', {
      method: 'POST',
      body,
      credentials: 'include'
    })
    await refresh()
  } finally {
    syncing.value = false
  }
}

defineExpose({ refresh: refreshFromBrevo, pending: isLoading })
</script>

<template>
  <div class="space-y-5 sm:space-y-6">
    <section
      class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4"
      aria-label="Analytics filters"
    >
      <div class="w-full shrink-0 sm:w-auto">
        <span class="mb-1.5 block text-xs font-medium text-zinc-500">Date range</span>
        <TenantBrevoTrackingDateRangePicker
          v-model:preset="datePreset"
          v-model:custom-from="customDateFrom"
          v-model:custom-to="customDateTo"
          :label="dateRangeLabel"
          :preset-options="BREVO_SMTP_STATS_DATE_PRESET_OPTIONS"
        />
      </div>

      <TenantMarketingAnalyticsCampaignPicker
        v-model="selectedCampaignId"
        :campaigns="campaignOptions"
      />

      <div v-if="showUserFilter" class="w-full shrink-0 sm:w-72">
        <span class="mb-1.5 block text-xs font-medium text-zinc-500">User</span>
        <TenantFilterSelect
          id="marketing-analytics-user-filter"
          v-model="selectedUserEmail"
          label="Filter by user"
          variant="tracking"
          :options="userFilterOptions"
        />
      </div>

      <button
        v-if="hasActiveFilters"
        type="button"
        class="inline-flex h-11 w-11 shrink-0 items-center justify-center self-end rounded-2xl border border-zinc-200/90 bg-white text-zinc-500 shadow-sm shadow-zinc-950/5 transition hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-800"
        aria-label="Clear filters"
        title="Clear filters"
        @click="clearAllFilters"
      >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </section>

    <div
      v-if="error"
      class="flex gap-3 rounded-2xl border border-red-200/80 bg-red-50/90 px-4 py-3.5 text-sm text-red-900 shadow-sm"
      role="alert"
    >
      <svg class="mt-0.5 h-5 w-5 shrink-0 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
      <span class="min-w-0 leading-relaxed">{{ error.message || 'Failed to load analytics' }}</span>
    </div>

    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
      <div
        class="inline-flex w-fit rounded-full border border-zinc-200/90 bg-zinc-100/80 p-0.5 shadow-sm shadow-zinc-950/[0.03]"
        role="tablist"
        aria-label="Analytics view"
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

      <div class="w-full shrink-0 sm:w-56">
        <span class="mb-1.5 block text-xs font-medium text-zinc-500">Event type</span>
        <TenantFilterSelect
          id="marketing-analytics-event-filter"
          v-model="selectedEventType"
          label="Filter by event type"
          variant="tracking"
          :options="eventFilterOptions"
        />
      </div>
    </div>

    <TenantMarketingAnalyticsMetricCards
      v-if="topView === 'metrics'"
      :cards="metricCards"
      :loading="isLoading"
    />

    <TenantMarketingAnalyticsChart
      v-else
      :points="timeseries"
      :date-range="effectiveDateRange"
      :loading="isLoading"
      :event-type="selectedEventType"
    />

    <TenantMarketingAnalyticsMessagesTable
      :items="eventItems"
      :loading="isLoading"
      :page="eventsPage"
      :has-more="eventsHasMore"
      :range-title="messagesRangeTitle"
      @update:page="eventsPage = $event"
    />
  </div>
</template>
