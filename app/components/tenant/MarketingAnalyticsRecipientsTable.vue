<script setup lang="ts">
import { brevoEventTypeTooltip } from '~/utils/brevoEventTypeTooltip'

export interface AnalyticsRecipientEvent {
  email?: string
  date?: string
  event?: string
  subject?: string
  tag?: string
  messageId?: string
}

const props = withDefaults(
  defineProps<{
    events: AnalyticsRecipientEvent[]
    loading?: boolean
  }>(),
  { loading: false }
)

interface RecipientRow {
  email: string
  eventTypes: string[]
  latestIso: string
}

/** One row per recipient; event types in first-seen order by date. */
const recipientRows = computed((): RecipientRow[] => {
  const sorted = [...props.events].sort(
    (a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime()
  )
  const order = new Map<string, string[]>()
  const displayEmail = new Map<string, string>()
  const latest = new Map<string, string>()

  for (const e of sorted) {
    const raw = (e.email || '').trim()
    if (!raw) continue
    const key = raw.toLowerCase()
    if (!displayEmail.has(key)) displayEmail.set(key, raw)
    if (e.date) latest.set(key, e.date)
    const ev = (e.event || '').trim()
    if (!ev) continue
    if (!order.has(key)) order.set(key, [])
    const arr = order.get(key)!
    if (!arr.includes(ev)) arr.push(ev)
  }

  return [...order.entries()]
    .map(([key, eventTypes]) => ({
      email: displayEmail.get(key) ?? key,
      eventTypes,
      latestIso: latest.get(key) || ''
    }))
    .sort(
      (a, b) =>
        new Date(b.latestIso || 0).getTime() - new Date(a.latestIso || 0).getTime()
    )
})

const searchQuery = ref('')

const rowsAfterSearch = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return recipientRows.value
  return recipientRows.value.filter((r) => r.email.toLowerCase().includes(q))
})

const availableEventTypes = computed(() => {
  const s = new Set<string>()
  for (const row of rowsAfterSearch.value) {
    for (const ev of row.eventTypes) s.add(ev)
  }
  return [...s].sort((a, b) => {
    if (a === 'requests') return -1
    if (b === 'requests') return 1
    return a.localeCompare(b)
  })
})

const selectedEventTypes = ref<string[]>(['requests'])

function preferredEventTypeFilter(types: string[]): string[] {
  return types.includes('requests') ? ['requests'] : []
}

watch(
  [availableEventTypes, () => props.loading],
  ([types, loading]) => {
    if (loading) return
    if (!types.length) return

    const sel = selectedEventTypes.value
    if (!sel.length) return

    const next = sel.filter((t) => types.includes(t))
    if (next.length === sel.length) return

    selectedEventTypes.value = next.length ? next : preferredEventTypeFilter(types)
  }
)

function toggleEventFilter(name: string) {
  const i = selectedEventTypes.value.indexOf(name)
  if (i === -1) selectedEventTypes.value = [...selectedEventTypes.value, name]
  else selectedEventTypes.value = selectedEventTypes.value.filter((_, j) => j !== i)
}

function clearEventFilters() {
  selectedEventTypes.value = []
}

const recipientCountByEventType = computed(() => {
  const m = new Map<string, number>()
  for (const row of rowsAfterSearch.value) {
    for (const ev of row.eventTypes) {
      m.set(ev, (m.get(ev) ?? 0) + 1)
    }
  }
  return m
})

function recipientCountForEventType(t: string): number {
  return recipientCountByEventType.value.get(t) ?? 0
}

const filteredRows = computed(() => {
  const rows = rowsAfterSearch.value
  const sel = selectedEventTypes.value
  if (!sel.length) return rows
  return rows
    .filter((r) => r.eventTypes.some((ev) => sel.includes(ev)))
    .map((r) => ({
      ...r,
      eventTypes: r.eventTypes.filter((ev) => sel.includes(ev))
    }))
})

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const
const tablePageSize = ref(20)

const {
  currentPage,
  totalPages,
  paginatedItems,
  paginationMeta,
  pageInput,
  commitPageInput
} = useClientPagination(filteredRows, tablePageSize)

watch([searchQuery, selectedEventTypes], () => {
  currentPage.value = 1
})

function formatEventDate(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

function eventBadgeClass(ev: string | undefined): string {
  const e = (ev || '').toLowerCase()
  if (e === 'delivered') return 'bg-emerald-50 text-emerald-800 ring-emerald-200/80'
  if (e === 'requests' || e === 'sent') return 'bg-sky-50 text-sky-800 ring-sky-200/80'
  if (e.includes('bounce') || e === 'hardbounces' || e === 'softbounces')
    return 'bg-rose-50 text-rose-800 ring-rose-200/80'
  if (e.includes('open') || e === 'opened') return 'bg-violet-50 text-violet-800 ring-violet-200/80'
  if (e.includes('click') || e === 'clicks') return 'bg-amber-50 text-amber-800 ring-amber-200/80'
  if (e === 'error' || e === 'blocked' || e === 'invalid')
    return 'bg-red-50 text-red-800 ring-red-200/80'
  return 'bg-zinc-100 text-zinc-700 ring-zinc-200/80'
}
</script>

<template>
  <div
    class="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm shadow-zinc-950/[0.04]"
    :aria-busy="loading"
  >
    <div class="border-b border-zinc-100 px-4 py-3.5 sm:px-6 sm:py-4">
      <h2 class="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Recipients
      </h2>
      <p class="mt-1 text-sm text-zinc-500">
        Unique recipients and event types for the selected filters.
      </p>
    </div>

    <div
      v-if="!loading && recipientRows.length"
      class="space-y-3 border-b border-zinc-100 bg-zinc-50/40 px-4 py-3 sm:px-6"
    >
      <div class="relative max-w-md">
        <label class="sr-only" for="analytics-recipients-search">Search recipients</label>
        <svg
          class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          id="analytics-recipients-search"
          v-model="searchQuery"
          type="search"
          autocomplete="off"
          placeholder="Search by email…"
          class="w-full rounded-xl border border-zinc-200/90 bg-white py-2.5 pl-9 pr-3 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
        >
      </div>

      <div v-if="availableEventTypes.length" class="flex flex-wrap gap-2">
        <UiHoverTip :text="brevoEventTypeTooltip('all')">
          <button
            type="button"
            class="rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition"
            :class="
              selectedEventTypes.length === 0
                ? 'bg-zinc-900 text-white ring-zinc-900 shadow-sm'
                : 'bg-white text-zinc-700 ring-zinc-200/90 shadow-sm hover:bg-zinc-50'
            "
            @click="clearEventFilters"
          >
            All
            <span class="ml-1 tabular-nums opacity-90">({{ rowsAfterSearch.length }})</span>
          </button>
        </UiHoverTip>
        <UiHoverTip
          v-for="t in availableEventTypes"
          :key="t"
          :text="brevoEventTypeTooltip(t)"
        >
          <button
            type="button"
            class="rounded-full px-3 py-1.5 text-xs font-medium capitalize ring-1 transition"
            :class="
              selectedEventTypes.includes(t)
                ? 'bg-zinc-900 text-white ring-zinc-900 shadow-sm'
                : 'bg-white text-zinc-700 ring-zinc-200/90 shadow-sm hover:bg-zinc-50'
            "
            @click="toggleEventFilter(t)"
          >
            {{ t }}
            <span class="ml-1 tabular-nums opacity-90">({{ recipientCountForEventType(t) }})</span>
          </button>
        </UiHoverTip>
      </div>
    </div>

    <TenantBrevoTrackingTableSkeleton v-if="loading" />

    <div
      v-else-if="recipientRows.length === 0"
      class="px-4 py-14 text-center sm:px-6"
    >
      <p class="text-sm font-medium text-zinc-900">No recipients in this range</p>
      <p class="mt-1 text-sm text-zinc-500">
        Adjust filters or click Refresh to sync the latest events.
      </p>
    </div>

    <div
      v-else-if="filteredRows.length === 0"
      class="px-4 py-14 text-center sm:px-6"
    >
      <p class="text-sm font-medium text-zinc-900">No recipients match your filters</p>
      <p class="mt-1 text-sm text-zinc-500">
        Try clearing search or resetting event types.
      </p>
    </div>

    <template v-else>
      <ul class="divide-y divide-zinc-100 lg:hidden">
        <li
          v-for="row in paginatedItems"
          :key="row.email"
          class="space-y-2 p-4"
        >
          <p class="break-all text-sm font-medium text-zinc-900">{{ row.email }}</p>
          <p class="text-xs tabular-nums text-zinc-500">
            {{ formatEventDate(row.latestIso) }}
          </p>
          <div class="flex flex-wrap gap-1.5">
            <UiHoverTip
              v-for="ev in row.eventTypes"
              :key="ev"
              :text="brevoEventTypeTooltip(ev)"
            >
              <span
                class="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize ring-1 ring-inset"
                :class="eventBadgeClass(ev)"
              >
                {{ ev }}
              </span>
            </UiHoverTip>
          </div>
        </li>
      </ul>

      <div class="hidden overflow-x-auto lg:block">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="border-b border-zinc-200 bg-zinc-50/90">
              <th
                scope="col"
                class="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 sm:px-6"
              >
                Recipient
              </th>
              <th
                scope="col"
                class="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 sm:px-6"
              >
                Latest activity
              </th>
              <th
                scope="col"
                class="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 sm:px-6"
              >
                Events
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-zinc-100">
            <tr
              v-for="row in paginatedItems"
              :key="row.email"
              class="hover:bg-zinc-50/50"
            >
              <td class="max-w-xs break-all px-5 py-4 font-medium text-zinc-900 sm:px-6">
                {{ row.email }}
              </td>
              <td class="whitespace-nowrap px-5 py-4 tabular-nums text-zinc-600 sm:px-6">
                {{ formatEventDate(row.latestIso) }}
              </td>
              <td class="px-5 py-4 sm:px-6">
                <div class="flex flex-wrap gap-1.5">
                  <UiHoverTip
                    v-for="ev in row.eventTypes"
                    :key="ev"
                    :text="brevoEventTypeTooltip(ev)"
                  >
                    <span
                      class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset"
                      :class="eventBadgeClass(ev)"
                    >
                      {{ ev }}
                    </span>
                  </UiHoverTip>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        class="flex flex-col gap-3 border-t border-zinc-100 bg-zinc-50/60 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-4"
      >
        <p class="min-w-0 text-xs tabular-nums text-zinc-500 sm:text-sm">
          <span class="font-semibold text-zinc-800">{{ paginationMeta.from }}–{{ paginationMeta.to }}</span>
          <span class="text-zinc-300"> / </span>
          <span>{{ paginationMeta.total.toLocaleString() }}</span>
        </p>

        <div class="flex flex-wrap items-center gap-2 sm:gap-3">
          <label class="flex items-center gap-2 text-xs text-zinc-500 sm:text-sm">
            <span class="whitespace-nowrap">Rows per page</span>
            <select
              v-model.number="tablePageSize"
              class="h-9 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-medium tabular-nums text-zinc-800 shadow-sm focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 sm:rounded-xl sm:px-3 sm:text-[0.8125rem]"
              aria-label="Rows per page"
            >
              <option v-for="size in PAGE_SIZE_OPTIONS" :key="size" :value="size">
                {{ size }}
              </option>
            </select>
          </label>

          <nav class="flex shrink-0 items-center gap-1 sm:gap-1.5" aria-label="Recipients pagination">
            <button
              type="button"
              class="inline-flex h-9 min-w-[4.25rem] items-center justify-center rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-semibold text-zinc-800 shadow-sm transition-colors hover:bg-zinc-50 disabled:pointer-events-none disabled:text-zinc-400 sm:min-w-[5.5rem] sm:rounded-xl sm:px-3.5 sm:py-2.5 sm:text-[0.8125rem]"
              :disabled="currentPage === 1"
              @click="currentPage -= 1"
            >
              Previous
            </button>
            <div class="flex items-center gap-1 px-1 text-xs font-medium tabular-nums text-zinc-500 sm:text-[0.8125rem]">
              <label class="sr-only" for="analytics-recipients-page">Page</label>
              <input
                id="analytics-recipients-page"
                v-model="pageInput"
                type="number"
                min="1"
                :max="totalPages"
                inputmode="numeric"
                class="h-9 w-12 rounded-lg border border-zinc-200 bg-white px-1 text-center text-xs font-semibold text-zinc-800 shadow-sm [appearance:textfield] focus:outline-none focus:ring-2 focus:ring-zinc-900/10 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none sm:w-14 sm:rounded-xl sm:text-[0.8125rem]"
                @keydown.enter.prevent="commitPageInput"
                @blur="commitPageInput"
              >
              <span aria-hidden="true">/ {{ totalPages }}</span>
            </div>
            <button
              type="button"
              class="inline-flex h-9 min-w-[4.25rem] items-center justify-center rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-semibold text-zinc-800 shadow-sm transition-colors hover:bg-zinc-50 disabled:pointer-events-none disabled:text-zinc-400 sm:min-w-[5.5rem] sm:rounded-xl sm:px-3.5 sm:py-2.5 sm:text-[0.8125rem]"
              :disabled="currentPage >= totalPages"
              @click="currentPage += 1"
            >
              Next
            </button>
          </nav>
        </div>
      </div>
    </template>
  </div>
</template>
