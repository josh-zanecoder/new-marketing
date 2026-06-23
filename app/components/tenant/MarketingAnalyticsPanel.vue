<script setup lang="ts">
import { useBrevoTrackingDateRange } from '~/composables/useBrevoTrackingDateRange'
import type { MarketingAnalyticsPayload } from '~/types/marketingAnalytics'
import {
  buildMarketingAnalyticsMetricCards
} from '~/utils/marketingAnalyticsChart'

const selectedCampaignId = ref('')

const {
  datePreset,
  customDateFrom,
  customDateTo,
  effectiveDateRange,
  dateRangeFilterActive,
  dateRangeLabel,
  resetDateRange
} = useBrevoTrackingDateRange()

const analyticsQuery = computed(() => {
  const query: Record<string, string> = {}
  const range = effectiveDateRange.value
  if (range.from) query.from = range.from
  if (range.to) query.to = range.to
  const campaignId = selectedCampaignId.value.trim()
  if (campaignId) query.campaignId = campaignId
  return query
})

const fetchKey = computed(
  () => `tenant-marketing-analytics-${JSON.stringify(analyticsQuery.value)}`
)

const { data, error, pending, refresh } = useFetch<{ analytics: MarketingAnalyticsPayload }>(
  '/api/v1/tracking/analytics',
  {
    query: analyticsQuery,
    key: fetchKey
  }
)

const { data: campaignsListData } = useFetch<{ campaigns: Array<{ id: string; name: string }> }>(
  '/api/v1/tenant/campaigns',
  { key: 'tenant-marketing-analytics-campaigns' }
)

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

const hasActiveFilters = computed(
  () => dateRangeFilterActive.value || !!selectedCampaignId.value.trim()
)

function clearAllFilters() {
  resetDateRange()
  selectedCampaignId.value = ''
}
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
        <div class="flex shrink-0 items-center gap-2">
          <button
            type="button"
            class="inline-flex flex-1 items-center justify-center whitespace-nowrap rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:opacity-50 sm:flex-none"
            :disabled="pending"
            @click="() => refresh()"
          >
            Refresh
          </button>
          <button
            v-if="hasActiveFilters"
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
