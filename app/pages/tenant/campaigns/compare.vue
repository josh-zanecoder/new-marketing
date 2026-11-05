<script setup lang="ts">
import type { BrevoSmtpAggregated } from '~/types/brevoSmtpStats'
import {
  BREVO_SMTP_STATS_DATE_PRESET_OPTIONS,
  BREVO_SMTP_STATS_MAX_RANGE_DAYS,
  useBrevoTrackingDateRange
} from '~/composables/useBrevoTrackingDateRange'

definePageMeta({ layout: 'default' })

const { data: campaignsListData } = useTenantCampaignsList()
const campaignOptions = computed(() =>
  (campaignsListData.value?.campaigns ?? []).map((c) => ({
    id: c.id,
    label: (c.name || '').trim() || c.id
  }))
)

const selectedIds = ref<string[]>([])
const compareError = ref('')
const comparing = ref(false)

type CompareRow = {
  campaignId: string
  name: string
  aggregated: BrevoSmtpAggregated
}

const compareRows = ref<CompareRow[]>([])

const {
  datePreset,
  customDateFrom,
  customDateTo,
  effectiveDateRange,
  dateRangeLabel
} = useBrevoTrackingDateRange({ maxRangeDays: BREVO_SMTP_STATS_MAX_RANGE_DAYS })

function toggleCampaign(id: string) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else if (next.size < 5) next.add(id)
  selectedIds.value = [...next]
}

async function runCompare() {
  compareError.value = ''
  if (selectedIds.value.length < 2) {
    compareError.value = 'Pick at least two campaigns.'
    return
  }
  const from = effectiveDateRange.value.from?.trim()
  const to = effectiveDateRange.value.to?.trim()
  if (!from || !to) {
    compareError.value = 'Pick a date range.'
    return
  }
  comparing.value = true
  try {
    const params = new URLSearchParams({
      campaignIds: selectedIds.value.join(','),
      from,
      to,
      tzOffset: String(new Date().getTimezoneOffset())
    })
    const res = await $fetch<{
      campaigns: CompareRow[]
    }>(`/api/v1/tracking/stats/compare?${params.toString()}`, {
      credentials: 'include'
    })
    compareRows.value = res.campaigns ?? []
  } catch (e: unknown) {
    compareRows.value = []
    compareError.value =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string; statusMessage?: string } }).data?.message ||
            (e as { data?: { statusMessage?: string } }).data?.statusMessage ||
            '')
        : e instanceof Error
          ? e.message
          : 'Compare failed'
  } finally {
    comparing.value = false
  }
}

const metricDefs = [
  { key: 'requests', label: 'Sent', rate: null },
  { key: 'delivered', label: 'Delivered', rate: 'deliveredPct' },
  { key: 'uniqueOpens', label: 'Trackable openers', rate: 'uniqueOpensPct' },
  { key: 'opens', label: 'Opens', rate: 'opensPct' },
  { key: 'clicks', label: 'Clicks', rate: 'uniqueClicksPct' },
  { key: 'hardBounces', label: 'Hard bounces', rate: 'hardBouncesPct' }
] as const

function cellCount(row: CompareRow, key: (typeof metricDefs)[number]['key']): number {
  return Number(row.aggregated[key] ?? 0)
}

function cellRate(row: CompareRow, rate: string | null): string {
  if (!rate) return ''
  const pct = Number((row.aggregated.rates as Record<string, number>)?.[rate] ?? 0)
  return `${pct.toFixed(1)}%`
}
</script>

<template>
  <div class="mx-auto w-full min-w-0 max-w-6xl">
    <header class="mb-6 space-y-1 sm:mb-8">
      <p class="text-xs font-semibold uppercase tracking-wider text-primary-600">Campaigns</p>
      <h1 class="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">
        Compare campaigns
      </h1>
      <p class="max-w-2xl text-sm text-zinc-500">
        Side-by-side delivery, opens, and bounces — e.g. client vs prospect lists.
      </p>
    </header>

    <div class="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
      <TenantBrevoTrackingDateRangePicker
        v-model:preset="datePreset"
        v-model:custom-from="customDateFrom"
        v-model:custom-to="customDateTo"
        :label="dateRangeLabel"
        :preset-options="BREVO_SMTP_STATS_DATE_PRESET_OPTIONS"
        :max-range-days="BREVO_SMTP_STATS_MAX_RANGE_DAYS"
      />

      <div>
        <p class="mb-2 text-xs font-medium text-zinc-500">
          Select 2–5 campaigns ({{ selectedIds.length }} selected)
        </p>
        <div class="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-xl border border-zinc-100 p-2">
          <label
            v-for="opt in campaignOptions"
            :key="opt.id"
            class="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-zinc-50"
          >
            <input
              type="checkbox"
              class="rounded border-zinc-300"
              :checked="selectedIds.includes(opt.id)"
              :disabled="!selectedIds.includes(opt.id) && selectedIds.length >= 5"
              @change="toggleCampaign(opt.id)"
            >
            <span class="truncate text-zinc-800">{{ opt.label }}</span>
          </label>
          <p v-if="!campaignOptions.length" class="px-2 py-3 text-sm text-zinc-500">
            No campaigns yet.
          </p>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <button
          type="button"
          class="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          :disabled="comparing || selectedIds.length < 2"
          @click="runCompare"
        >
          {{ comparing ? 'Comparing…' : 'Compare' }}
        </button>
        <p v-if="compareError" class="text-sm text-red-700">{{ compareError }}</p>
      </div>
    </div>

    <div v-if="compareRows.length" class="mt-6 overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <table class="min-w-full border-collapse text-sm">
        <thead>
          <tr class="border-b border-zinc-100 bg-zinc-50 text-left">
            <th class="px-4 py-3 font-semibold text-zinc-700">Metric</th>
            <th
              v-for="row in compareRows"
              :key="row.campaignId"
              class="px-4 py-3 font-semibold text-zinc-900"
            >
              <NuxtLink
                :to="`/tenant/campaigns/${row.campaignId}`"
                class="hover:underline"
              >
                {{ row.name }}
              </NuxtLink>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="metric in metricDefs"
            :key="metric.key"
            class="border-b border-zinc-50"
          >
            <td class="px-4 py-2.5 font-medium text-zinc-600">{{ metric.label }}</td>
            <td
              v-for="row in compareRows"
              :key="`${row.campaignId}-${metric.key}`"
              class="px-4 py-2.5 text-zinc-900"
            >
              {{ cellCount(row, metric.key).toLocaleString() }}
              <span v-if="metric.rate" class="ml-1 text-xs text-zinc-500">
                ({{ cellRate(row, metric.rate) }})
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
