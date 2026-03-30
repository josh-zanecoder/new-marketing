<template>
  <div class="min-h-screen bg-white">
    <div class="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] lg:px-8">
      <header class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 class="text-2xl font-bold text-slate-900 tracking-tight">
          Recipient lists
        </h1>
        <NuxtLink
          to="/tenant/recipient-list/add"
          class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 shrink-0"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          New list
        </NuxtLink>
      </header>

      <div
        v-if="data && !data.tenantIdConfigured"
        class="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
      >
        Your tenant has no <strong>tenant ID</strong> in the registry. Lists can still use audience only;
        admin-defined recipient filters apply once a tenant ID is set.
      </div>

      <div
        v-if="loadError"
        class="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
      >
        {{ loadError }}
      </div>

      <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div class="relative flex-1">
          <svg class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search lists"
            class="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300"
          >
        </div>
      </div>

      <div v-if="pending" class="space-y-3">
        <div v-for="n in 4" :key="n" class="h-24 animate-pulse rounded-xl bg-slate-100" />
      </div>

      <div
        v-else-if="data && !filteredLists.length"
        class="rounded-xl border border-slate-200 bg-slate-50/50 px-8 py-20 text-center"
      >
        <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-slate-200/80 text-slate-500">
          <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <h3 class="mt-4 text-lg font-semibold text-slate-900">
          No lists yet
        </h3>
        <p class="mt-1 text-sm text-slate-500">
          {{ data.lists.length ? 'No lists match your search' : 'Create your first recipient list to use in campaigns' }}
        </p>
        <NuxtLink
          v-if="!data.lists.length"
          to="/tenant/recipient-list/add"
          class="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
        >
          New list
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </NuxtLink>
      </div>

      <div v-else-if="data" class="space-y-3">
        <div
          v-for="row in paginatedLists"
          :key="row.id"
          class="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300 sm:flex-row sm:items-center sm:gap-6"
        >
          <NuxtLink
            :to="`/tenant/recipient-list/${row.id}`"
            class="min-w-0 flex-1 outline-none"
          >
            <span class="font-semibold text-slate-900">
              {{ row.name }}
            </span>
            <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
              <span class="inline-flex rounded px-1.5 py-0.5 font-medium capitalize bg-slate-100 text-slate-700">
                {{ row.listType }}
              </span>
              <span class="capitalize">{{ row.audience || '—' }}</span>
              <span>#{{ row.id.slice(-6) }}</span>
              <span v-if="row.updatedAt">{{ formatDate(row.updatedAt) }}</span>
            </div>
            <p class="mt-2 text-sm text-slate-600 line-clamp-2">
              {{ formatFilters(row.filters, row.filterMode) }}
            </p>
          </NuxtLink>
          <NuxtLink
            :to="`/tenant/recipient-list/edit/${row.id}`"
            class="inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Edit
          </NuxtLink>
        </div>

        <div
          v-if="filteredLists.length"
          class="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between"
        >
          <span>
            Showing {{ paginationMeta.from }}-{{ paginationMeta.to }} of {{ paginationMeta.total }}
          </span>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="currentPage === 1"
              @click="currentPage -= 1"
            >
              Previous
            </button>
            <span class="text-slate-500">Page {{ currentPage }} of {{ totalPages }}</span>
            <button
              type="button"
              class="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="currentPage === totalPages"
              @click="currentPage += 1"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
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
  listType: string
  audience: string
  filters: ListCriterion[]
  filterMode?: 'and' | 'or'
  updatedAt: string | null
}

interface RecipientListIndexPayload {
  tenantIdConfigured: boolean
  lists: ListRow[]
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
const currentPage = ref(1)

const filteredLists = computed(() => {
  const lists = data.value?.lists ?? []
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return lists
  return lists.filter((row) => row.name.toLowerCase().includes(q))
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

watch([searchQuery], () => {
  currentPage.value = 1
})

watch(totalPages, (pages) => {
  if (currentPage.value > pages) currentPage.value = pages
})

function formatFilters(
  filters: ListCriterion[] | undefined,
  filterMode?: 'and' | 'or'
): string {
  if (!filters?.length) return 'No filter criteria'
  const joined =
    filters.length >= 2 && filterMode === 'or'
      ? filters.map((f) => `${f.property} = ${f.value}`).join(' OR ')
      : filters.map((f) => `${f.property} = ${f.value}`).join(' · ')
  return joined
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(iso))
  } catch {
    return iso
  }
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
      lists: res.lists ?? []
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
