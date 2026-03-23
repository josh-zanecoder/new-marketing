<template>
  <div class="min-h-screen bg-white">
    <div class="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] lg:px-8">
      <NuxtLink
        to="/tenant/recipient-list"
        class="mb-8 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
      >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        Recipient lists
      </NuxtLink>

      <div
        v-if="loadError"
        class="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
      >
        {{ loadError }}
      </div>

      <div v-if="pending" class="space-y-6">
        <div class="h-10 max-w-md animate-pulse rounded-lg bg-slate-100" />
        <div class="h-40 animate-pulse rounded-xl bg-slate-100" />
        <div class="h-64 animate-pulse rounded-xl bg-slate-100" />
      </div>

      <template v-else-if="payload">
        <header class="mb-8 border-b border-slate-200 pb-6">
          <h1 class="text-2xl font-bold text-slate-900 tracking-tight">
            {{ payload.list.name }}
          </h1>
          <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            <span class="inline-flex rounded px-1.5 py-0.5 text-xs font-medium capitalize bg-slate-100 text-slate-700">
              {{ payload.list.listType }}
            </span>
            <span class="capitalize">{{ payload.list.audience }}</span>
            <span v-if="payload.list.updatedAt">{{ formatDate(payload.list.updatedAt) }}</span>
          </div>
        </header>

        <section class="mb-10">
          <div class="mb-3 flex flex-wrap items-baseline gap-2">
            <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Filters
            </h2>
            <span
              v-if="(payload.list.filters?.length ?? 0) >= 2 && payload.list.filterMode"
              class="text-xs font-medium text-slate-500"
            >
              Combined with <span class="uppercase">{{ payload.list.filterMode }}</span>
            </span>
          </div>
          <div
            v-if="!payload.list.filters?.length"
            class="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-600"
          >
            No filter criteria (audience only).
          </div>
          <ul
            v-else
            class="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white"
          >
            <li
              v-for="(f, i) in payload.list.filters"
              :key="i"
              class="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-4 py-3 text-sm"
            >
              <span class="font-medium capitalize text-slate-800">{{ f.property }}</span>
              <span class="text-slate-400">=</span>
              <span class="text-slate-700">{{ f.value }}</span>
            </li>
          </ul>
        </section>

        <section>
          <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Recipients
              <span class="font-normal normal-case text-slate-600">
                ({{ payload.members.total }})
              </span>
            </h2>
          </div>

          <div
            v-if="!payload.members.total"
            class="rounded-xl border border-slate-200 bg-slate-50/50 px-6 py-12 text-center text-sm text-slate-600"
          >
            No contacts match this list yet.
          </div>

          <div v-else class="overflow-hidden rounded-xl border border-slate-200">
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead class="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th class="px-4 py-3">Name</th>
                    <th class="px-4 py-3">Email</th>
                    <th class="px-4 py-3">Kind</th>
                    <th class="hidden px-4 py-3 sm:table-cell">Company</th>
                    <th class="hidden px-4 py-3 lg:table-cell">Location</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 bg-white">
                  <tr
                    v-for="m in payload.members.items"
                    :key="m.id"
                    class="hover:bg-slate-50/80"
                  >
                    <td class="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                      {{ m.name }}
                    </td>
                    <td class="whitespace-nowrap px-4 py-3 text-slate-600">
                      {{ m.email }}
                    </td>
                    <td class="whitespace-nowrap px-4 py-3 capitalize text-slate-600">
                      {{ m.contactKind }}
                    </td>
                    <td class="hidden max-w-[12rem] truncate px-4 py-3 text-slate-600 sm:table-cell">
                      {{ m.company || '—' }}
                    </td>
                    <td class="hidden max-w-[14rem] truncate px-4 py-3 text-slate-600 lg:table-cell">
                      {{ formatAddress(m.address) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div
              v-if="payload.members.totalPages > 1"
              class="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between"
            >
              <span>
                Page {{ payload.members.page }} of {{ payload.members.totalPages }}
              </span>
              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="page <= 1 || pageLoading"
                  @click="goPage(page - 1)"
                >
                  Previous
                </button>
                <button
                  type="button"
                  class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="page >= payload.members.totalPages || pageLoading"
                  @click="goPage(page + 1)"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">

definePageMeta({ layout: 'default' })

interface ListCriterion {
  property: string
  value: string
}

interface MemberRow {
  id: string
  name: string
  email: string
  phone: string
  contactKind: string
  company: string
  channel: string
  source: string
  address: Record<string, unknown>
}

interface ListDetailPayload {
  list: {
    id: string
    name: string
    listType: string
    audience: string
    filters: ListCriterion[]
    filterMode?: 'and' | 'or'
    createdAt: string | null
    updatedAt: string | null
  }
  members: {
    items: MemberRow[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
}

function serverAuthHeaders(): { headers?: HeadersInit } {
  if (!import.meta.server) return {}
  try {
    return { headers: useRequestHeaders(['cookie']) as HeadersInit }
  } catch {
    return {}
  }
}

const route = useRoute()
const listId = computed(() => String(route.params.id ?? ''))

const pending = ref(true)
const pageLoading = ref(false)
const loadError = ref('')
const payload = ref<ListDetailPayload | null>(null)
const page = ref(1)

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

function formatAddress(addr: Record<string, unknown>): string {
  const parts = [
    addr.city,
    addr.state,
    addr.county
  ].filter((x) => typeof x === 'string' && x.trim())
  return parts.length ? parts.join(', ') : '—'
}

async function load(p: number) {
  const id = listId.value
  if (!id) {
    loadError.value = 'Missing list id'
    pending.value = false
    return
  }
  const isInitial = !payload.value
  if (!isInitial) pageLoading.value = true
  loadError.value = ''
  try {
    const res = await $fetch<ListDetailPayload>(
      `/api/v1/tenant/recipient-list/${encodeURIComponent(id)}`,
      {
        credentials: 'include',
        ...serverAuthHeaders(),
        query: { page: p, limit: 50 }
      }
    )
    payload.value = res
    page.value = res.members.page
  } catch (e: unknown) {
    loadError.value =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message ?? 'Failed to load')
        : 'Failed to load'
    payload.value = null
  } finally {
    pending.value = false
    pageLoading.value = false
  }
}

async function goPage(p: number) {
  if (p < 1) return
  await load(p)
}

watch(
  listId,
  () => {
    pending.value = true
    page.value = 1
    load(1)
  },
  { immediate: true }
)
</script>
