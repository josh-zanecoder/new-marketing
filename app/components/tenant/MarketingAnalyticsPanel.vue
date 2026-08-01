<script setup lang="ts">
import { useBrevoTrackingDateRange } from '~/composables/useBrevoTrackingDateRange'
import type { MarketingAnalyticsPayload } from '~/types/marketingAnalytics'
import {
  buildMarketingAnalyticsMetricCards
} from '~/utils/marketingAnalyticsChart'

const selectedCampaignId = ref('')
const selectedUserEmail = ref('')

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

/**
 * Whether the session may pass `?userEmail=` (before analytics loads).
 * Matches server `resolveTrackingUserScope`.
 */
const canFilterByUserTag = computed(() => {
  if (me.value?.authType === 'firebase') {
    return me.value.role === 'tenant'
  }
  if (me.value?.authType !== 'apiKey') return false
  if (me.value.tenantWideContacts === true) return true
  const owners = me.value.contactOwnerEmails?.length ?? 0
  return owners === 0 || owners > 1
})

const analyticsQuery = computed(() => {
  const query: Record<string, string> = {}
  const range = effectiveDateRange.value
  if (range.from) query.from = range.from
  if (range.to) query.to = range.to
  query.tzOffset = String(new Date().getTimezoneOffset())
  const campaignId = selectedCampaignId.value.trim()
  if (campaignId) query.campaignId = campaignId
  if (canFilterByUserTag.value) {
    const userEmail = selectedUserEmail.value.trim().toLowerCase()
    if (userEmail) query.userEmail = userEmail
  }
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
    getCachedData: (key, nuxtApp) =>
      nuxtApp.payload.data[key] ?? nuxtApp.static.data[key]
  }
)

const { data: campaignsListData } = useTenantCampaignsList()

const analytics = computed(() => data.value?.analytics)
const metricCards = computed(() => buildMarketingAnalyticsMetricCards(analytics.value?.summary))
const timeseries = computed(() => analytics.value?.timeseries ?? [])

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
    !!selectedUserEmail.value.trim()
)

function clearAllFilters() {
  resetDateRange()
  selectedCampaignId.value = ''
  selectedUserEmail.value = ''
}

defineExpose({ refresh, pending })
</script>

<template>
  <div class="space-y-6 sm:space-y-8">
    <section
      class="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm shadow-zinc-950/[0.04] sm:p-5"
      aria-label="Analytics filters"
    >
      <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <h2 class="text-sm font-semibold text-zinc-900">
            Filters
          </h2>
          <p class="mt-0.5 text-xs text-zinc-500">
            Refine metrics and the performance chart
          </p>
        </div>
        <div v-if="hasActiveFilters" class="flex shrink-0 items-center gap-2">
          <button
            type="button"
            class="inline-flex flex-1 items-center justify-center whitespace-nowrap rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 sm:flex-none"
            @click="clearAllFilters"
          >
            Clear filters
          </button>
        </div>
      </div>

      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-5">
        <div class="w-full shrink-0 lg:w-auto">
          <span class="mb-1.5 block text-xs font-medium text-zinc-500">Date range</span>
          <TenantBrevoTrackingDateRangePicker
            v-model:preset="datePreset"
            v-model:custom-from="customDateFrom"
            v-model:custom-to="customDateTo"
            :label="dateRangeLabel"
          />
        </div>

        <TenantMarketingAnalyticsCampaignPicker
          v-model="selectedCampaignId"
          :campaigns="campaignOptions"
        />

        <div v-if="showUserFilter" class="w-full shrink-0 lg:w-72">
          <span class="mb-1.5 block text-xs font-medium text-zinc-500">User</span>
          <TenantFilterSelect
            id="marketing-analytics-user-filter"
            v-model="selectedUserEmail"
            label="Filter by user"
            variant="tracking"
            :options="userFilterOptions"
          />
        </div>
      </div>
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

    <TenantMarketingAnalyticsMetricCards :cards="metricCards" :loading="pending" />

    <TenantMarketingAnalyticsChart
      :points="timeseries"
      :date-range="effectiveDateRange"
      :loading="pending"
    />
  </div>
</template>
