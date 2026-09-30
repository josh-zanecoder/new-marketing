<script setup lang="ts">
import type { AdminTenantRow } from '~/types/adminTenant'

definePageMeta({ layout: 'admin' })

type AdminRecipientListRow = {
  id: string
  tenantDbName: string
  tenantName: string
  name: string
  memberCount: number
  builtBy: string
  updatedAt: string
}

type AdminRecipientListsResponse = {
  lists: AdminRecipientListRow[]
  total: number
  page: number
  limit: number
  totalPages: number
}

const PAGE_SIZE = 25

const searchQuery = ref('')
const searchDebounced = ref('')
const tenantFilter = ref('')
const page = ref(1)
const tenants = ref<AdminTenantRow[]>([])

const tenantFilterSelectOptions = computed(() => [
  { value: '', label: 'All tenants' },
  ...tenants.value.map((t) => ({ value: t.dbName, label: t.name }))
])

const requestKey = computed(() =>
  JSON.stringify({
    page: page.value,
    tenant: tenantFilter.value,
    search: searchDebounced.value.trim()
  })
)

let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(searchQuery, (value) => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    searchDebounced.value = value
    page.value = 1
  }, 300)
})

watch(tenantFilter, () => {
  page.value = 1
})

onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer)
})

await useAsyncData('admin-recipient-lists-tenants', async () => {
  const reqFetch = import.meta.server ? useRequestFetch() : $fetch
  const res = await reqFetch<{ tenants: AdminTenantRow[] }>('/api/v1/admin/tenants', {
    credentials: 'include'
  })
  tenants.value = res.tenants ?? []
  return true
})

const { data, pending, error, refresh } = await useAsyncData(
  'admin-recipient-lists',
  () => {
    const reqFetch = import.meta.server ? useRequestFetch() : $fetch
    return reqFetch<AdminRecipientListsResponse>('/api/v1/admin/recipient-lists', {
      credentials: 'include',
      query: {
        page: page.value,
        limit: PAGE_SIZE,
        tenantDbName: tenantFilter.value || undefined,
        search: searchDebounced.value.trim() || undefined
      }
    })
  },
  { watch: [requestKey] }
)

const lists = computed(() => data.value?.lists ?? [])
const total = computed(() => data.value?.total ?? 0)
const totalPages = computed(() => data.value?.totalPages ?? 1)

const paginationMeta = computed(() => {
  if (!total.value) return { from: 0, to: 0, total: 0 }
  const from = (page.value - 1) * PAGE_SIZE + 1
  const to = Math.min(page.value * PAGE_SIZE, total.value)
  return { from, to, total: total.value }
})

function formatUpdated(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function memberLabel(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? 'person' : 'people'}`
}

function showTenantHeading(index: number): boolean {
  const row = lists.value[index]
  if (!row) return false
  if (index === 0) return true
  return lists.value[index - 1]?.tenantDbName !== row.tenantDbName
}
</script>

<template>
  <div class="mx-auto w-full min-w-0 max-w-6xl space-y-6 overflow-x-hidden antialiased sm:space-y-8">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div class="min-w-0 space-y-1">
        <p class="page-eyebrow">Audience</p>
        <h1 class="page-title">Recipient lists</h1>
        <p class="page-lead max-w-2xl sm:text-[0.9375rem] sm:leading-relaxed">
          Every list a campaign can send to, grouped by tenant, with who built it and how many people are on it.
        </p>
      </div>
      <TenantRefreshIconButton
        label="Refresh recipient lists"
        :pending="pending"
        @click="() => refresh()"
      />
    </header>

    <div
      v-if="error"
      class="flex gap-3.5 rounded-2xl border border-red-200/90 bg-red-50 px-5 py-4 text-sm leading-snug text-red-900 shadow-sm"
      role="alert"
    >
      Unable to load recipient lists.
    </div>

    <div class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
      <div class="relative min-w-0 w-full sm:flex-1 sm:max-w-lg">
        <label class="sr-only" for="admin-recipient-lists-search">Search recipient lists</label>
        <svg
          class="pointer-events-none absolute left-3.5 top-1/2 h-[1.125rem] w-[1.125rem] -translate-y-1/2 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          id="admin-recipient-lists-search"
          v-model="searchQuery"
          type="search"
          autocomplete="off"
          placeholder="Search list name or owner…"
          class="input !rounded-input-lg bg-slate-50 py-3 pl-11 pr-4 focus:bg-white sm:py-3.5 sm:text-[0.9375rem]"
        >
      </div>
      <TenantFilterSelect
        id="admin-recipient-lists-tenant-filter"
        v-model="tenantFilter"
        label="Filter by tenant"
        :options="tenantFilterSelectOptions"
        class="w-full shrink-0 sm:w-[14rem]"
      />
    </div>

    <div
      v-if="pending && !data"
      class="animate-pulse space-y-3"
      aria-busy="true"
      aria-label="Loading recipient lists"
    >
      <div v-for="n in 6" :key="n" class="h-16 rounded-2xl border border-slate-200 bg-white" />
    </div>

    <div
      v-else-if="!lists.length"
      class="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-14 text-center shadow-sm sm:px-6 sm:py-20"
    >
      <h3 class="text-lg font-semibold tracking-tight text-slate-900">
        {{ searchQuery.trim() || tenantFilter ? 'No matching lists' : 'No recipient lists yet' }}
      </h3>
      <p class="mt-2.5 max-w-sm text-sm leading-relaxed text-slate-500">
        {{ searchQuery.trim() || tenantFilter ? 'Try a different search or tenant.' : 'Lists created by tenants will appear here.' }}
      </p>
    </div>

    <div v-else class="space-y-4">
      <template v-for="(row, index) in lists" :key="`${row.tenantDbName}:${row.id}`">
        <h2
          v-if="showTenantHeading(index)"
          class="px-1 pt-2 text-xs font-semibold uppercase tracking-wider text-slate-500"
        >
          {{ row.tenantName }}
        </h2>
        <article
          class="rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] sm:px-6"
        >
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="truncate text-[15px] font-semibold text-slate-900">
                {{ row.name }}
              </p>
              <p class="mt-0.5 truncate text-sm text-slate-500">
                {{ row.builtBy ? `Built by ${row.builtBy}` : 'Owner not recorded' }}
              </p>
            </div>
            <div class="flex shrink-0 flex-col items-end gap-1">
              <span class="text-sm font-semibold tabular-nums text-slate-900">
                {{ memberLabel(row.memberCount) }}
              </span>
              <span class="text-xs text-slate-400">
                Updated {{ formatUpdated(row.updatedAt) }}
              </span>
            </div>
          </div>
        </article>
      </template>

      <div
        class="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/60 px-4 py-3.5 shadow-sm sm:px-6 sm:py-4"
      >
        <p class="min-w-0 text-xs tabular-nums text-slate-500 sm:text-sm">
          <span class="font-semibold text-slate-800">{{ paginationMeta.from }}–{{ paginationMeta.to }}</span>
          <span class="text-slate-300"> / </span>
          <span>{{ paginationMeta.total.toLocaleString() }}</span>
        </p>
        <nav class="flex shrink-0 items-center gap-1 sm:gap-1.5" aria-label="Recipient lists pagination">
          <button
            type="button"
            class="inline-flex h-9 min-w-[4.25rem] items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 shadow-sm disabled:pointer-events-none disabled:text-slate-400 sm:min-w-[5.5rem] sm:rounded-xl sm:px-3.5 sm:py-2.5 sm:text-[0.8125rem]"
            :disabled="page <= 1 || pending"
            @click="page -= 1"
          >
            Previous
          </button>
          <span class="whitespace-nowrap px-1 text-center text-xs font-medium tabular-nums text-slate-500 sm:min-w-[6.5rem] sm:text-[0.8125rem]">
            Page {{ page }} / {{ totalPages }}
          </span>
          <button
            type="button"
            class="inline-flex h-9 min-w-[4.25rem] items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 shadow-sm disabled:pointer-events-none disabled:text-slate-400 sm:min-w-[5.5rem] sm:rounded-xl sm:px-3.5 sm:py-2.5 sm:text-[0.8125rem]"
            :disabled="page >= totalPages || pending"
            @click="page += 1"
          >
            Next
          </button>
        </nav>
      </div>
    </div>
  </div>
</template>
