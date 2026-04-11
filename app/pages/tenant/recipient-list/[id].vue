<template>
  <div class="w-full min-w-0">
    <div class="mx-auto max-w-6xl">
    <NuxtLink
      to="/tenant/recipient-list"
      class="group mb-6 inline-flex items-center gap-2 text-sm font-medium text-zinc-600 transition hover:text-zinc-900 sm:mb-8"
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
      <header class="mb-8 overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm shadow-zinc-950/[0.04] ring-1 ring-zinc-100/80 sm:mb-10">
        <div class="h-1 bg-gradient-to-r from-violet-500/90 via-violet-400/70 to-zinc-300/60" aria-hidden="true" />
        <div class="flex flex-col gap-6 p-5 sm:flex-row sm:items-start sm:justify-between sm:gap-8 sm:p-6 lg:p-8">
          <div class="min-w-0 flex-1 space-y-4">
            <h1 class="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl lg:text-[2rem] lg:leading-tight">
              {{ payload.list.name }}
            </h1>
            <div class="flex flex-wrap items-center gap-2 sm:gap-2.5">
              <span
                class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold capitalize ring-1 ring-inset"
                :class="listTypeBadgeClass(payload.list.listType)"
              >
                {{ payload.list.listType }}
              </span>
              <span
                v-if="payload.list.audience"
                class="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold capitalize text-zinc-800 ring-1 ring-zinc-200/80"
              >
                {{ payload.list.audience }}
              </span>
            </div>
            <p
              v-if="payload.list.updatedAt"
              class="flex items-center gap-2 text-sm text-zinc-500"
            >
              <svg class="h-4 w-4 shrink-0 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="tabular-nums">Last updated {{ formatDate(payload.list.updatedAt) }}</span>
            </p>
          </div>
          <div class="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
            <NuxtLink
              :to="`/tenant/recipient-list/edit/${listId}`"
              class="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-zinc-900/15 transition hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
            >
              <svg class="h-4 w-4 text-white/90" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit list
            </NuxtLink>
            <button
              type="button"
              class="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-5 py-3 text-sm font-medium text-red-700 shadow-sm transition hover:border-red-200 hover:bg-red-50/80"
              @click="deleteConfirmOpen = true"
            >
              <svg class="h-4 w-4 text-red-600/90" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          </div>
        </div>
      </header>

      <section class="mb-8 sm:mb-10">
        <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 class="text-sm font-semibold text-zinc-900">
              Inclusion criteria
            </h2>
            <p class="mt-1 max-w-2xl text-sm text-zinc-600">
              Registry rules applied on top of the audience. Edit the list to change them.
            </p>
          </div>
          <span
            v-if="hasListCriteria"
            class="inline-flex w-fit items-center rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold tabular-nums text-zinc-700 ring-1 ring-zinc-200/80"
          >
            {{ criteriaRuleCount }} {{ criteriaRuleCount === 1 ? 'rule' : 'rules' }}
          </span>
        </div>
        <div
          v-if="!hasListCriteria"
          class="flex flex-col items-center rounded-2xl border border-dashed border-zinc-300/90 bg-gradient-to-b from-zinc-50/50 to-white px-6 py-10 text-center shadow-sm sm:flex-row sm:items-center sm:gap-5 sm:py-9 sm:text-left"
        >
          <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-violet-600 shadow-sm ring-1 ring-zinc-200/80">
            <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </div>
          <div>
            <p class="text-base font-semibold text-zinc-900">
              Audience only
            </p>
            <p class="mt-1 max-w-md text-sm leading-relaxed text-zinc-600">
              No extra filters — everyone in this audience can be included (subject to campaign rules).
            </p>
          </div>
        </div>
        <div
          v-else
          class="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm shadow-zinc-950/[0.04] ring-1 ring-zinc-100/80 sm:p-5"
          role="group"
          aria-label="List filter criteria"
        >
          <p class="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Active filters
          </p>
          <div class="flex min-h-[3rem] min-w-0 flex-wrap items-center gap-2 sm:gap-2.5">
            <template v-for="(seg, i) in criteriaSegments" :key="i">
              <span
                v-if="seg.kind === 'criterion'"
                class="inline-flex max-w-full items-center gap-2 rounded-xl border border-zinc-200/90 bg-gradient-to-b from-zinc-50/80 to-white px-3 py-2 text-sm shadow-sm ring-1 ring-zinc-100/60"
              >
                <span class="shrink-0 text-xs font-semibold capitalize tracking-wide text-zinc-500">{{ seg.property }}</span>
                <span class="shrink-0 rounded-md bg-zinc-900/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">equals</span>
                <span class="min-w-0 break-words font-semibold text-zinc-900">{{ seg.value }}</span>
              </span>
              <span
                v-else
                class="inline-flex shrink-0 items-center justify-center rounded-lg bg-violet-100 px-2.5 py-2 text-[11px] font-bold uppercase tracking-wider text-violet-900 ring-1 ring-violet-200/90"
              >
                {{ seg.op }}
              </span>
            </template>
          </div>
        </div>
      </section>

      <section>
        <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="text-sm font-semibold text-zinc-900">
              Recipients
            </h2>
            <p class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-600">
              <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-200/80">
                {{ payload.members.total.toLocaleString() }}
                {{ payload.members.total === 1 ? 'contact' : 'contacts' }}
              </span>
              <span class="text-zinc-400">·</span>
              <span class="text-zinc-500">Matching this list right now</span>
            </p>
          </div>
          <p
            v-if="pageLoading"
            class="inline-flex items-center gap-2 text-sm font-medium text-violet-700"
          >
            <span class="relative flex h-2 w-2">
              <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
              <span class="relative inline-flex h-2 w-2 rounded-full bg-violet-500" />
            </span>
            Loading…
          </p>
        </div>

        <div
          v-if="!payload.members.total"
          class="rounded-2xl border border-dashed border-zinc-300/90 bg-zinc-50/30 px-6 py-14 text-center shadow-sm"
        >
          <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white text-zinc-400 shadow-sm ring-1 ring-zinc-200/80">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <p class="text-sm font-semibold text-zinc-900">
            No matching contacts
          </p>
          <p class="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-zinc-600">
            Adjust filters or audience, or wait if sync is still in progress.
          </p>
        </div>

        <div
          v-else
          class="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-md shadow-zinc-950/[0.06] ring-1 ring-zinc-100/80"
        >
          <div class="overflow-x-auto">
            <table class="min-w-full text-left text-sm">
              <thead>
                <tr class="border-b border-zinc-200 bg-zinc-50/90">
                  <th scope="col" class="whitespace-nowrap px-4 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500 sm:px-6">
                    Name
                  </th>
                  <th scope="col" class="whitespace-nowrap px-4 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500 sm:px-6">
                    Email
                  </th>
                  <th scope="col" class="whitespace-nowrap px-4 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500 sm:px-6">
                    Kind
                  </th>
                  <th scope="col" class="hidden whitespace-nowrap px-4 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500 sm:table-cell sm:px-6">
                    Company
                  </th>
                  <th scope="col" class="hidden whitespace-nowrap px-4 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500 lg:table-cell lg:px-6">
                    Location
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-zinc-100">
                <tr
                  v-for="m in payload.members.items"
                  :key="m.id"
                  class="bg-white transition-colors hover:bg-violet-50/30"
                >
                  <td class="whitespace-nowrap px-4 py-3.5 font-semibold text-zinc-900 sm:px-6">
                    {{ m.name }}
                  </td>
                  <td class="max-w-[14rem] truncate px-4 py-3.5 text-zinc-700 sm:max-w-xs sm:px-6" :title="m.email">
                    {{ m.email }}
                  </td>
                  <td class="max-w-[12rem] px-4 py-3.5 sm:px-6">
                    <div v-if="m.contactType?.length" class="flex flex-wrap gap-1">
                      <span
                        v-for="t in m.contactType"
                        :key="`${m.id}-${t}`"
                        class="inline-flex rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium capitalize text-zinc-800 ring-1 ring-zinc-200/80"
                      >
                        {{ t }}
                      </span>
                    </div>
                    <span
                      v-else
                      class="text-xs text-zinc-400"
                    >
                      —
                    </span>
                  </td>
                  <td class="hidden max-w-[10rem] truncate px-4 py-3.5 text-zinc-700 sm:table-cell sm:max-w-[12rem] sm:px-6" :title="m.company || undefined">
                    {{ m.company || '—' }}
                  </td>
                  <td class="hidden max-w-[12rem] truncate px-4 py-3.5 text-zinc-700 lg:table-cell lg:max-w-[16rem] lg:px-6" :title="formatAddress(m.address)">
                    {{ formatAddress(m.address) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div
            v-if="payload.members.totalPages > 1"
            class="flex flex-col gap-4 border-t border-zinc-200 bg-zinc-50/70 px-4 py-4 text-sm text-zinc-600 sm:flex-row sm:items-center sm:justify-between sm:px-6"
          >
            <p class="tabular-nums text-zinc-600">
              Page <span class="font-semibold text-zinc-900">{{ payload.members.page }}</span>
              of {{ payload.members.totalPages }}
              <span class="text-zinc-300">·</span>
              {{ payload.members.pageSize }} per page
            </p>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="inline-flex min-w-[88px] items-center justify-center rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="page <= 1 || pageLoading"
                @click="goPage(page - 1)"
              >
                Previous
              </button>
              <button
                type="button"
                class="inline-flex min-w-[88px] items-center justify-center rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
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
  </div>
</template>

<script setup lang="ts">
import type { TenantRecipientListDetailPayload } from '~/types/tenantContact'

definePageMeta({ layout: 'default' })

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
const payload = ref<TenantRecipientListDetailPayload | null>(null)
const page = ref(1)
const deleteConfirmOpen = ref(false)
const deleteDetailPending = ref(false)

const deleteDetailMessage = computed(() => {
  const name = payload.value?.list?.name?.trim()
  const label = name ? `“${name}”` : 'this list'
  return `Permanently delete ${label}? Campaigns that used it will have the list unlinked (they become manual audience with any saved recipients). This cannot be undone.`
})

type CriteriaSegment =
  | { kind: 'criterion'; property: string; value: string }
  | { kind: 'op'; op: 'AND' | 'OR' }

/** Chips + AND/OR indicators for the criteria row. */
const criteriaSegments = computed((): CriteriaSegment[] => {
  const list = payload.value?.list
  if (!list) return []
  const chain = list.criteriaChain
  if (chain?.rows?.length) {
    const rows = chain.rows
    const joins = chain.joins
    const fallback: 'AND' | 'OR' = list.filterMode === 'or' ? 'OR' : 'AND'
    const out: CriteriaSegment[] = []
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]!
      out.push({ kind: 'criterion', property: r.property, value: r.value })
      if (i < rows.length - 1) {
        const j = joins?.[i]
        const op: 'AND' | 'OR' =
          j === 'or' ? 'OR' : j === 'and' ? 'AND' : fallback
        out.push({ kind: 'op', op })
      }
    }
    return out
  }
  const filters = list.filters ?? []
  if (!filters.length) return []
  const sep: 'AND' | 'OR' = list.filterMode === 'or' ? 'OR' : 'AND'
  const out: CriteriaSegment[] = []
  for (let i = 0; i < filters.length; i++) {
    const f = filters[i]!
    out.push({ kind: 'criterion', property: f.property, value: f.value })
    if (i < filters.length - 1) out.push({ kind: 'op', op: sep })
  }
  return out
})

const hasListCriteria = computed(() => criteriaSegments.value.length > 0)

const criteriaRuleCount = computed(
  () => criteriaSegments.value.filter((s) => s.kind === 'criterion').length
)

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
    const res = await $fetch<TenantRecipientListDetailPayload>(
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
