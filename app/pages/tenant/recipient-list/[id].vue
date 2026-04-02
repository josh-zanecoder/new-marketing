<template>
  <div class="w-full min-w-0">
    <NuxtLink
      to="/tenant/recipient-list"
      class="group mb-8 inline-flex items-center gap-2 text-sm font-medium text-zinc-600 transition hover:text-zinc-900"
    >
      <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100/80 text-zinc-500 transition group-hover:bg-zinc-200/80 group-hover:text-zinc-800">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </span>
      Recipient lists
    </NuxtLink>

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

    <div v-if="pending" class="space-y-4">
      <div class="h-9 max-w-lg animate-pulse rounded-xl bg-zinc-100" />
      <div class="h-28 animate-pulse rounded-2xl bg-zinc-100" />
      <div class="h-72 animate-pulse rounded-2xl border border-zinc-200/80 bg-white shadow-sm" />
    </div>

    <template v-else-if="payload">
      <header class="mb-8 flex flex-col gap-5 sm:mb-10 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0 space-y-3">
          <h1 class="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
            {{ payload.list.name }}
          </h1>
          <div class="flex flex-wrap items-center gap-2">
            <span
              class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset"
              :class="listTypeBadgeClass(payload.list.listType)"
            >
              {{ payload.list.listType }}
            </span>
            <span
              v-if="payload.list.audience"
              class="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium capitalize text-zinc-700 ring-1 ring-zinc-200/80"
            >
              {{ payload.list.audience }}
            </span>
            <span v-if="payload.list.updatedAt" class="text-xs tabular-nums text-zinc-400 sm:text-sm">
              Updated {{ formatDate(payload.list.updatedAt) }}
            </span>
          </div>
        </div>
        <div class="flex shrink-0 flex-wrap items-center gap-2">
          <NuxtLink
            :to="`/tenant/recipient-list/edit/${listId}`"
            class="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
          >
            <svg class="h-4 w-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit list
          </NuxtLink>
          <button
            type="button"
            class="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-700 shadow-sm transition hover:border-red-300 hover:bg-red-50"
            @click="deleteConfirmOpen = true"
          >
            Delete list
          </button>
        </div>
      </header>

      <section class="mb-8 sm:mb-10">
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <h2 class="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Criteria
          </h2>
          <span
            v-if="(payload.list.filters?.length ?? 0) >= 2 && payload.list.filterMode"
            class="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-600"
          >
            {{ payload.list.filterMode }}
          </span>
        </div>
        <div
          v-if="!payload.list.filters?.length"
          class="flex flex-col items-center rounded-2xl border border-dashed border-zinc-200 bg-white px-6 py-10 text-center shadow-sm sm:flex-row sm:items-center sm:gap-4 sm:py-8 sm:text-left"
        >
          <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </div>
          <div>
            <p class="text-sm font-medium text-zinc-900">
              Audience only
            </p>
            <p class="mt-1 text-sm text-zinc-500">
              No extra filters — everyone in this audience can be included (subject to campaign rules).
            </p>
          </div>
        </div>
        <ul
          v-else
          class="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm shadow-zinc-950/[0.04]"
        >
          <li
            v-for="(f, i) in payload.list.filters"
            :key="i"
            class="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-zinc-100 px-4 py-3.5 text-sm last:border-b-0 sm:px-5"
          >
            <span class="font-medium capitalize text-zinc-900">{{ f.property }}</span>
            <span class="rounded-md bg-zinc-200/60 px-1.5 py-0.5 text-xs font-semibold text-zinc-600">=</span>
            <span class="break-words text-zinc-700">{{ f.value }}</span>
          </li>
        </ul>
      </section>

      <section>
        <div class="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 class="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Recipients
            </h2>
            <p class="mt-1 text-sm tabular-nums text-zinc-600">
              <span class="font-semibold text-zinc-900">{{ payload.members.total.toLocaleString() }}</span>
              {{ payload.members.total === 1 ? 'contact' : 'contacts' }}
            </p>
          </div>
          <p v-if="pageLoading" class="text-xs text-zinc-400">
            Loading…
          </p>
        </div>

        <div
          v-if="!payload.members.total"
          class="rounded-2xl border border-dashed border-zinc-200 bg-white px-6 py-14 text-center shadow-sm"
        >
          <p class="text-sm font-medium text-zinc-900">
            No matching contacts
          </p>
          <p class="mt-2 text-sm text-zinc-500">
            Adjust filters or audience, or sync may still be in progress.
          </p>
        </div>

        <div
          v-else
          class="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm shadow-zinc-950/[0.04]"
        >
          <div class="overflow-x-auto">
            <table class="min-w-full text-left text-sm">
              <thead class="border-b border-zinc-200 bg-zinc-50/80">
                <tr>
                  <th class="whitespace-nowrap px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 sm:px-5">
                    Name
                  </th>
                  <th class="whitespace-nowrap px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 sm:px-5">
                    Email
                  </th>
                  <th class="whitespace-nowrap px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 sm:px-5">
                    Kind
                  </th>
                  <th class="hidden whitespace-nowrap px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 sm:table-cell sm:px-5">
                    Company
                  </th>
                  <th class="hidden whitespace-nowrap px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 lg:table-cell lg:px-5">
                    Location
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-zinc-100">
                <tr
                  v-for="m in payload.members.items"
                  :key="m.id"
                  class="bg-white transition hover:bg-zinc-50/80"
                >
                  <td class="whitespace-nowrap px-4 py-3 font-medium text-zinc-900 sm:px-5">
                    {{ m.name }}
                  </td>
                  <td class="max-w-[14rem] truncate px-4 py-3 text-zinc-600 sm:max-w-xs sm:px-5">
                    {{ m.email }}
                  </td>
                  <td class="whitespace-nowrap px-4 py-3 capitalize text-zinc-600 sm:px-5">
                    {{ m.contactKind }}
                  </td>
                  <td class="hidden max-w-[10rem] truncate px-4 py-3 text-zinc-600 sm:table-cell sm:max-w-[12rem] sm:px-5">
                    {{ m.company || '—' }}
                  </td>
                  <td class="hidden max-w-[12rem] truncate px-4 py-3 text-zinc-600 lg:table-cell lg:max-w-[16rem] lg:px-5" :title="formatAddress(m.address)">
                    {{ formatAddress(m.address) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div
            v-if="payload.members.totalPages > 1"
            class="flex flex-col gap-4 border-t border-zinc-200 bg-zinc-50/50 px-4 py-4 text-sm text-zinc-600 sm:flex-row sm:items-center sm:justify-between sm:px-5"
          >
            <p class="tabular-nums text-zinc-500">
              Page <span class="font-medium text-zinc-800">{{ payload.members.page }}</span>
              of {{ payload.members.totalPages }}
              <span class="text-zinc-400">·</span>
              {{ payload.members.pageSize }} per page
            </p>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="inline-flex min-w-[88px] items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="page <= 1 || pageLoading"
                @click="goPage(page - 1)"
              >
                Previous
              </button>
              <button
                type="button"
                class="inline-flex min-w-[88px] items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
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

    <ClientConfirmationModal
      :open="deleteConfirmOpen"
      title="Delete recipient list"
      :message="deleteDetailMessage"
      confirm-text="Delete list"
      variant="danger"
      @confirm="confirmDeleteDetail"
      @cancel="deleteConfirmOpen = false"
    />
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
  firstName: string
  lastName: string
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

function listTypeBadgeClass(listType: string): string {
  const t = listType.toLowerCase()
  if (t.includes('dynamic')) return 'bg-violet-50 text-violet-800 ring-violet-200/80'
  if (t.includes('static')) return 'bg-sky-50 text-sky-800 ring-sky-200/80'
  if (t.includes('prospect')) return 'bg-emerald-50 text-emerald-800 ring-emerald-200/80'
  return 'bg-zinc-100 text-zinc-700 ring-zinc-200/80'
}

const pending = ref(true)
const pageLoading = ref(false)
const loadError = ref('')
const payload = ref<ListDetailPayload | null>(null)
const page = ref(1)
const deleteConfirmOpen = ref(false)
const deleteDetailPending = ref(false)

const deleteDetailMessage = computed(() => {
  const name = payload.value?.list?.name?.trim()
  const label = name ? `“${name}”` : 'this list'
  return `Permanently delete ${label}? Campaigns that used it will have the list unlinked (they become manual audience with any saved recipients). This cannot be undone.`
})

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

async function confirmDeleteDetail() {
  const id = listId.value
  if (!id || deleteDetailPending.value) return
  deleteDetailPending.value = true
  try {
    await $fetch(`/api/v1/tenant/recipient-list/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
      ...serverAuthHeaders()
    })
    deleteConfirmOpen.value = false
    await navigateTo('/tenant/recipient-list')
  } catch (e: unknown) {
    loadError.value =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message ?? 'Failed to delete list')
        : 'Failed to delete list'
    deleteConfirmOpen.value = false
  } finally {
    deleteDetailPending.value = false
  }
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
