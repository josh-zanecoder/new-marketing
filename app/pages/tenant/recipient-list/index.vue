<template>
  <div class="w-full min-w-0">
      <header class="mb-8 flex flex-col gap-6 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
        <div class="min-w-0 space-y-1">
          <h1 class="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
            Recipient lists
          </h1>
          <p class="max-w-xl text-sm text-zinc-500 sm:text-[15px]">
            Build segments for campaigns with filters on audience and contact attributes.
          </p>
        </div>
        <NuxtLink
          to="/tenant/recipient-list/add"
          class="group inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-zinc-900/20 transition hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
        >
          <svg class="h-4 w-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          New list
        </NuxtLink>
      </header>

      <div
        v-if="data && !data.tenantIdConfigured"
        class="mb-6 flex gap-3 rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-amber-50/30 px-4 py-3.5 text-sm text-amber-950 shadow-sm shadow-amber-900/5"
        role="status"
      >
        <div class="mt-0.5 shrink-0 text-amber-600">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <div>
          <p class="font-medium text-amber-950">
            Tenant ID not set
          </p>
          <p class="mt-1 text-amber-900/90">
            Your tenant has no <strong class="font-semibold">tenant ID</strong> in the registry. Lists can still use audience only;
            admin-defined recipient filters apply once a tenant ID is set.
          </p>
        </div>
      </div>

      <div
        v-if="loadError"
        class="mb-6 flex gap-3 rounded-2xl border border-red-200/80 bg-red-50 px-4 py-3.5 text-sm text-red-900 shadow-sm"
        role="alert"
      >
        <svg class="mt-0.5 h-5 w-5 shrink-0 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        {{ loadError }}
      </div>

      <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div class="relative min-w-0 w-full sm:w-80 md:w-96">
          <label class="sr-only" for="recipient-list-search">Search lists</label>
          <svg class="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            id="recipient-list-search"
            v-model="searchQuery"
            type="search"
            autocomplete="off"
            placeholder="Search by list name…"
            class="w-full rounded-2xl border border-zinc-200/90 bg-white py-3 pl-12 pr-4 text-sm text-zinc-900 shadow-sm shadow-zinc-950/5 placeholder:text-zinc-400 transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
          >
        </div>
        <select
          id="recipient-list-audience-filter"
          v-model="audienceFilter"
          aria-label="Filter by audience"
          class="shrink-0 rounded-2xl border border-zinc-200/90 bg-white px-4 py-3 text-sm font-medium text-zinc-800 shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 sm:min-w-[11rem]"
        >
          <option value="all">
            All audiences
          </option>
          <option
            v-for="opt in audienceOptions"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </option>
        </select>
      </div>

      <div v-if="pending" class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <div
          v-for="n in 6"
          :key="n"
          class="flex h-full flex-col rounded-xl border border-zinc-200/90 bg-white p-6 shadow-sm shadow-zinc-950/[0.06]"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0 flex-1 space-y-2">
              <div class="h-5 max-w-[75%] animate-pulse rounded-md bg-zinc-100" />
              <div class="h-3.5 w-28 animate-pulse rounded bg-zinc-100" />
            </div>
            <div class="flex shrink-0 gap-3">
              <div class="h-4 w-10 animate-pulse rounded bg-zinc-100" />
              <div class="h-4 w-12 animate-pulse rounded bg-zinc-100" />
            </div>
          </div>
          <div class="mt-5 flex-1 space-y-2">
            <div class="h-3 w-36 animate-pulse rounded bg-zinc-100" />
            <div class="h-7 w-4/5 max-w-[220px] animate-pulse rounded-full bg-zinc-100" />
          </div>
          <div class="mt-6 flex items-end justify-between border-t border-zinc-100 pt-5">
            <div class="h-3.5 w-24 animate-pulse rounded bg-zinc-100" />
            <div class="h-4 w-10 animate-pulse rounded bg-zinc-100" />
          </div>
        </div>
      </div>

      <div
        v-else-if="data && !filteredLists.length"
        class="flex flex-col items-center rounded-2xl border border-dashed border-zinc-200 bg-white px-6 py-16 text-center shadow-sm sm:py-20"
      >
        <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500 shadow-inner">
          <svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <h3 class="mt-5 text-lg font-semibold text-zinc-900">
          {{ data.lists.length ? 'No matching lists' : 'No lists yet' }}
        </h3>
        <p class="mt-2 max-w-sm text-sm leading-relaxed text-zinc-500">
          {{ data.lists.length ? 'Try a different search term or audience filter.' : 'Create your first recipient list to target audiences in email campaigns.' }}
        </p>
        <NuxtLink
          v-if="!data.lists.length"
          to="/tenant/recipient-list/add"
          class="mt-8 inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800"
        >
          Create list
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </NuxtLink>
      </div>

      <div v-else-if="data" class="space-y-6">
        <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <article
            v-for="row in paginatedLists"
            :key="row.id"
            class="flex h-full flex-col rounded-xl border border-zinc-200/90 bg-white p-6 shadow-sm shadow-zinc-950/[0.06] transition hover:border-zinc-300/90 hover:shadow-md hover:shadow-zinc-950/[0.08]"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0 flex-1">
                <NuxtLink
                  :to="`/tenant/recipient-list/${row.id}`"
                  class="block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30"
                >
                  <h2 class="text-base font-semibold leading-snug text-zinc-900">
                    {{ row.name }}
                  </h2>
                </NuxtLink>
                <p class="mt-1 text-sm text-zinc-500">
                  {{ listCardSubtitle(row) }}
                </p>
                <p
                  v-if="typeof row.memberCount === 'number'"
                  class="mt-2 text-sm font-semibold tabular-nums tracking-tight text-zinc-800"
                >
                  {{ formatRecipientCount(row) }}
                </p>
              </div>
              <div class="flex shrink-0 items-center gap-4 text-sm font-medium">
                <NuxtLink
                  :to="`/tenant/recipient-list/edit/${row.id}`"
                  class="text-zinc-700 transition hover:text-zinc-900"
                >
                  Edit
                </NuxtLink>
                <button
                  type="button"
                  class="text-red-600 transition hover:text-red-700"
                  @click="listToDelete = row"
                >
                  Delete
                </button>
              </div>
            </div>

            <div class="mt-5 flex-1">
              <p class="text-xs font-medium text-zinc-500">
                Includes people who:
              </p>
              <div class="mt-2 flex flex-wrap gap-2">
                <template v-if="row.filters?.length">
                  <span
                    v-for="(c, idx) in row.filters"
                    :key="idx"
                    class="inline-flex max-w-full items-center rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700"
                  >
                    <span class="truncate">{{ c.property }} = {{ c.value }}</span>
                  </span>
                </template>
                <span
                  v-else
                  class="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600"
                >
                  No filter criteria
                </span>
              </div>
            </div>

            <div class="mt-6 flex items-end justify-between gap-3 border-t border-zinc-100 pt-5">
              <p class="text-sm text-zinc-400">
                {{ listCardFooterLeft(row) }}
              </p>
              <NuxtLink
                :to="`/tenant/recipient-list/${row.id}`"
                class="shrink-0 text-sm font-medium text-violet-600 transition hover:text-violet-700"
              >
                View
              </NuxtLink>
            </div>
          </article>
        </div>

        <div
          v-if="filteredLists.length"
          class="flex flex-col gap-4 rounded-2xl border border-zinc-200/90 bg-white px-4 py-4 text-sm text-zinc-600 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-5"
        >
          <p class="tabular-nums text-zinc-500">
            <span class="font-medium text-zinc-800">{{ paginationMeta.from }}–{{ paginationMeta.to }}</span>
            of {{ paginationMeta.total }} lists
          </p>
          <div class="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              class="inline-flex min-w-[88px] items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="currentPage === 1"
              @click="currentPage -= 1"
            >
              Previous
            </button>
            <span class="min-w-[5rem] text-center tabular-nums text-zinc-500">
              Page {{ currentPage }} / {{ totalPages }}
            </span>
            <button
              type="button"
              class="inline-flex min-w-[88px] items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="currentPage === totalPages"
              @click="currentPage += 1"
            >
              Next
            </button>
          </div>
        </div>
      </div>

    <ClientConfirmationModal
      :open="!!listToDelete"
      title="Delete recipient list"
      :message="deleteListMessage"
      confirm-text="Delete list"
      variant="danger"
      @confirm="confirmDeleteList"
      @cancel="listToDelete = null"
    />
  </div>
</template>

<script setup lang="ts">

definePageMeta({ layout: 'default' })

const PAGE_SIZE = 10

interface ListCriterion {
  property: string
  value: string
}

interface ListRow {
  id: string
  name: string
  audience: string
  filters: ListCriterion[]
  filterMode?: 'and' | 'or'
  updatedAt: string | null
  /** Resolved members visible to the current user (from API). */
  memberCount?: number | null
}

interface RegistryFilterRow {
  id: string
  name: string
  contactType: string
  property: string
  propertyType: string
  propertyValue: string
  enabled: boolean
}

interface RecipientListIndexPayload {
  tenantIdConfigured: boolean
  lists: ListRow[]
  recipientFilters: RegistryFilterRow[]
}

function serverAuthHeaders(): { headers?: HeadersInit } {
  if (!import.meta.server) return {}
  try {
    return { headers: useRequestHeaders(['cookie']) as HeadersInit }
  } catch {
    return {}
  }
}

const pending = ref(true)
const loadError = ref('')
const data = ref<RecipientListIndexPayload | null>(null)
const searchQuery = ref('')
const audienceFilter = ref<string>('all')
const currentPage = ref(1)

/** Same ordering as add.vue — distinct enabled registry `contactType` values. */
const AUDIENCE_ORDER = ['prospect', 'client', 'contact'] as const

const audienceOptions = computed((): { value: string; label: string }[] => {
  const d = data.value
  if (!d?.recipientFilters?.length) return []
  const seen = new Set<string>()
  for (const f of d.recipientFilters) {
    if (f.enabled && typeof f.contactType === 'string' && f.contactType.trim()) {
      seen.add(f.contactType.trim())
    }
  }
  const ordered = AUDIENCE_ORDER.filter((k) => seen.has(k))
  const extra = [...seen].filter(
    (k) => !AUDIENCE_ORDER.includes(k as (typeof AUDIENCE_ORDER)[number])
  )
  extra.sort()
  return [...ordered, ...extra].map((value) => ({
    value,
    label: value.charAt(0).toUpperCase() + value.slice(1)
  }))
})

const filteredLists = computed(() => {
  const lists = data.value?.lists ?? []
  const q = searchQuery.value.trim().toLowerCase()
  let out = lists
  if (audienceFilter.value !== 'all') {
    const aud = audienceFilter.value.toLowerCase()
    out = out.filter((row) => (row.audience ?? '').toLowerCase() === aud)
  }
  if (q) {
    out = out.filter((row) => row.name.toLowerCase().includes(q))
  }
  return out
})

const totalPages = computed(() =>
  Math.max(1, Math.ceil(filteredLists.value.length / PAGE_SIZE))
)

const paginatedLists = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return filteredLists.value.slice(start, start + PAGE_SIZE)
})

const paginationMeta = computed(() => {
  const total = filteredLists.value.length
  if (!total) return { from: 0, to: 0, total: 0 }
  const from = (currentPage.value - 1) * PAGE_SIZE + 1
  const to = Math.min(currentPage.value * PAGE_SIZE, total)
  return { from, to, total }
})

watch([searchQuery, audienceFilter], () => {
  currentPage.value = 1
})

watch(audienceOptions, (opts) => {
  if (audienceFilter.value === 'all') return
  if (!opts.some((o) => o.value === audienceFilter.value)) {
    audienceFilter.value = 'all'
  }
})

watch(totalPages, (pages) => {
  if (currentPage.value > pages) currentPage.value = pages
})

const listToDelete = ref<ListRow | null>(null)
const deleteListPending = ref(false)

const deleteListMessage = computed(() => {
  const row = listToDelete.value
  if (!row) return ''
  return `Permanently delete “${row.name}”? Campaigns that used this list will have the list unlinked (they stay as manual audience with any saved recipients). This cannot be undone.`
})

async function confirmDeleteList() {
  const row = listToDelete.value
  if (!row || deleteListPending.value) return
  deleteListPending.value = true
  try {
    await $fetch(`/api/v1/tenant/recipient-list/${encodeURIComponent(row.id)}`, {
      method: 'DELETE',
      credentials: 'include',
      ...serverAuthHeaders()
    })
    listToDelete.value = null
    await load()
  } catch (e: unknown) {
    loadError.value =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message ?? 'Failed to delete list')
        : 'Failed to delete list'
    listToDelete.value = null
  } finally {
    deleteListPending.value = false
  }
}

function listCardSubtitle(row: ListRow): string {
  if (row.audience?.trim()) {
    return row.audience.charAt(0).toUpperCase() + row.audience.slice(1).toLowerCase()
  }
  if (row.updatedAt) {
    try {
      return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(row.updatedAt))
    } catch {
      return 'Recipient list'
    }
  }
  return 'Recipient list'
}

function formatRecipientCount(row: ListRow): string {
  const n = row.memberCount
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return ''
  const formatted = n.toLocaleString()
  return `${formatted} ${n === 1 ? 'recipient' : 'recipients'}`
}

function listCardFooterLeft(row: ListRow): string {
  if (row.updatedAt) {
    try {
      return `Updated ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(row.updatedAt))}`
    } catch {
      return ''
    }
  }
  return ''
}

async function load() {
  pending.value = true
  loadError.value = ''
  try {
    const res = await $fetch<RecipientListIndexPayload>('/api/v1/tenant/recipient-list', {
      credentials: 'include',
      ...serverAuthHeaders()
    })
    data.value = {
      tenantIdConfigured: res.tenantIdConfigured,
      lists: res.lists ?? [],
      recipientFilters: res.recipientFilters ?? []
    }
  } catch (e: unknown) {
    loadError.value =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message ?? 'Failed to load')
        : 'Failed to load'
    data.value = null
  } finally {
    pending.value = false
  }
}

onMounted(() => {
  load()
})
</script>
