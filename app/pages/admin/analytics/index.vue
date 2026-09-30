<script setup lang="ts">
import type { AdminTenantRow } from '~/types/adminTenant'
import type {
  MarketingAnalyticsSummary,
  MarketingAnalyticsTimeseriesPoint
} from '~/types/marketingAnalytics'
import {
  BREVO_SMTP_STATS_DATE_PRESET_OPTIONS,
  useBrevoTrackingDateRange
} from '~/composables/useBrevoTrackingDateRange'
import {
  buildMarketingAnalyticsMetricCards,
  formatMarketingAnalyticsPercent
} from '~/utils/marketingAnalyticsChart'

definePageMeta({ layout: 'admin' })

type TenantAnalyticsRow = {
  tenantDbName: string
  tenantName: string
  summary: MarketingAnalyticsSummary
}

type AdminAnalyticsResponse = {
  from: string
  to: string
  summary: MarketingAnalyticsSummary
  timeseries: MarketingAnalyticsTimeseriesPoint[]
  tenants: TenantAnalyticsRow[]
}

const tenantFilter = ref('')
const tenants = ref<AdminTenantRow[]>([])

const {
  datePreset,
  customDateFrom,
  customDateTo,
  effectiveDateRange,
  dateRangeLabel
} = useBrevoTrackingDateRange()

const tenantFilterSelectOptions = computed(() => [
  { value: '', label: 'All tenants' },
  ...tenants.value.map((t) => ({ value: t.dbName, label: t.name }))
])

await useAsyncData('admin-analytics-tenants', async () => {
  const reqFetch = import.meta.server ? useRequestFetch() : $fetch
  const res = await reqFetch<{ tenants: AdminTenantRow[] }>('/api/v1/admin/tenants', {
    credentials: 'include'
  })
  tenants.value = res.tenants ?? []
  return true
})

const analyticsQuery = computed(() => ({
  from: effectiveDateRange.value.from || undefined,
  to: effectiveDateRange.value.to || undefined,
  tzOffset: String(new Date().getTimezoneOffset()),
  tenantDbName: tenantFilter.value || undefined
}))

const { data, pending, error, refresh } = await useAsyncData(
  'admin-analytics',
  () => {
    const from = analyticsQuery.value.from
    const to = analyticsQuery.value.to
    if (!from || !to) return Promise.resolve(null)
    const reqFetch = import.meta.server ? useRequestFetch() : $fetch
    return reqFetch<AdminAnalyticsResponse>('/api/v1/admin/analytics', {
      credentials: 'include',
      query: analyticsQuery.value
    })
  },
  { watch: [analyticsQuery] }
)

const metricCards = computed(() => buildMarketingAnalyticsMetricCards(data.value?.summary))
const timeseries = computed(() => data.value?.timeseries ?? [])
const tenantRows = computed(() => data.value?.tenants ?? [])

function formatCount(value: number): string {
  return value.toLocaleString()
}
</script>

<template>
  <div class="mx-auto w-full min-w-0 max-w-6xl space-y-6 overflow-x-hidden antialiased sm:space-y-8">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div class="min-w-0 space-y-1">
        <p class="page-eyebrow">Insights</p>
        <h1 class="page-title">Analytics</h1>
        <p class="page-lead max-w-2xl sm:text-[0.9375rem] sm:leading-relaxed">
          Opens, clicks, and delivery across tenants, from tracking events already stored for each workspace.
        </p>
      </div>
      <TenantRefreshIconButton
        label="Refresh analytics"
        :pending="pending"
        @click="() => refresh()"
      />
    </header>

    <div
      v-if="error"
      class="rounded-2xl border border-red-200/90 bg-red-50 px-5 py-4 text-sm text-red-900"
      role="alert"
    >
      Unable to load analytics.
    </div>

    <div class="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div class="w-full shrink-0 sm:w-auto">
        <span class="mb-1.5 block text-xs font-medium text-slate-500">Date range</span>
        <TenantBrevoTrackingDateRangePicker
          v-model:preset="datePreset"
          v-model:custom-from="customDateFrom"
          v-model:custom-to="customDateTo"
          :label="dateRangeLabel"
          :preset-options="BREVO_SMTP_STATS_DATE_PRESET_OPTIONS"
        />
      </div>
      <TenantFilterSelect
        id="admin-analytics-tenant-filter"
        v-model="tenantFilter"
        label="Filter by tenant"
        :options="tenantFilterSelectOptions"
        class="w-full shrink-0 sm:w-[14rem]"
      />
    </div>

    <TenantMarketingAnalyticsMetricCards :cards="metricCards" :loading="pending && !data" />

    <TenantMarketingAnalyticsChart
      :points="timeseries"
      :date-range="effectiveDateRange"
      :loading="pending && !data"
    />

    <section class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div class="border-b border-slate-100 px-5 py-4">
        <h2 class="text-sm font-semibold text-slate-900">By tenant</h2>
        <p class="mt-1 text-xs text-slate-500">
          Tenants with no sends in this range are hidden unless you pick one.
        </p>
      </div>
      <p v-if="pending && !data" class="px-5 py-6 text-sm text-slate-400">Loading…</p>
      <p v-else-if="!tenantRows.length" class="px-5 py-6 text-sm text-slate-500">
        No sends in this range.
      </p>
      <div v-else class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th class="px-5 py-3">Tenant</th>
              <th class="px-4 py-3 text-right">Sent</th>
              <th class="px-4 py-3 text-right">Delivered</th>
              <th class="px-4 py-3 text-right">Delivery</th>
              <th class="px-4 py-3 text-right">Opens</th>
              <th class="px-4 py-3 text-right">Open rate</th>
              <th class="px-4 py-3 text-right">Clicks</th>
              <th class="px-5 py-3 text-right">Click rate</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="row in tenantRows" :key="row.tenantDbName">
              <td class="px-5 py-3 font-medium text-slate-900">{{ row.tenantName }}</td>
              <td class="px-4 py-3 text-right tabular-nums text-slate-700">{{ formatCount(row.summary.emailsSent) }}</td>
              <td class="px-4 py-3 text-right tabular-nums text-slate-700">{{ formatCount(row.summary.emailsDelivered) }}</td>
              <td class="px-4 py-3 text-right tabular-nums text-slate-700">
                {{ formatMarketingAnalyticsPercent(row.summary.emailsSent > 0 ? (row.summary.emailsDelivered / row.summary.emailsSent) * 100 : null) }}
              </td>
              <td class="px-4 py-3 text-right tabular-nums text-slate-700">{{ formatCount(row.summary.uniqueOpens) }}</td>
              <td class="px-4 py-3 text-right tabular-nums text-slate-700">{{ formatMarketingAnalyticsPercent(row.summary.openRate) }}</td>
              <td class="px-4 py-3 text-right tabular-nums text-slate-700">{{ formatCount(row.summary.uniqueClicks) }}</td>
              <td class="px-5 py-3 text-right tabular-nums text-slate-700">{{ formatMarketingAnalyticsPercent(row.summary.clickRate) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
