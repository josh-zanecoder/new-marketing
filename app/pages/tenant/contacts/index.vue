<template>
  <div class="w-full min-w-0">
    <header class="mb-8 sm:mb-10">
      <h1 class="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
        Contacts
      </h1>
      <p class="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500 sm:text-[15px]">
        All contacts in your tenant database, newest updates first.
      </p>
    </header>

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

    <div
      v-if="data?.truncated"
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
          Partial list
        </p>
        <p class="mt-1 text-amber-900/90">
          Showing the <strong class="font-semibold">{{ data.contacts.length }}</strong> most recently updated contacts.
          Total in database: <strong class="font-semibold tabular-nums">{{ data.total.toLocaleString() }}</strong>.
        </p>
      </div>
    </div>

    <div class="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
      <div class="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-3">
        <div class="min-w-0 flex-1">
          <label class="sr-only" for="contacts-search">Search contacts</label>
          <div class="relative">
            <svg class="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              id="contacts-search"
              v-model="searchQuery"
              type="search"
              autocomplete="off"
              placeholder="Search name, email, company, phone…"
              class="w-full rounded-2xl border border-zinc-200/90 bg-white py-3 pl-12 pr-4 text-sm text-zinc-900 shadow-sm shadow-zinc-950/5 placeholder:text-zinc-400 transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
            >
          </div>
        </div>
        <div class="w-full shrink-0 sm:w-[13.5rem]">
          <label class="sr-only" for="contacts-kind-filter">Contact type</label>
          <select
            id="contacts-kind-filter"
            v-model="contactKindFilter"
            class="w-full rounded-2xl border border-zinc-200/90 bg-white py-3 pl-4 pr-4 text-sm text-zinc-900 shadow-sm shadow-zinc-950/5 transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
          >
            <option value="all">
              All types
            </option>
            <option
              v-if="hasContactsWithoutKind"
              value="__none__"
            >
              No type
            </option>
            <option
              v-for="opt in contactTypeFilterOptions"
              :key="opt.key"
              :value="opt.key"
            >
              {{ opt.label }}
            </option>
          </select>
        </div>
      </div>
      <p v-if="data" class="shrink-0 tabular-nums text-sm text-zinc-600 lg:pt-3">
        <span class="font-semibold text-zinc-900">{{ data.total.toLocaleString() }}</span>
        in database
        <span v-if="filteredContacts.length !== data.contacts.length" class="text-zinc-400">·</span>
        <span v-if="filteredContacts.length !== data.contacts.length" class="text-zinc-500">
          <span class="font-medium text-zinc-800">{{ filteredContacts.length.toLocaleString() }}</span> matching
        </span>
      </p>
    </div>

    <div v-if="pending" class="space-y-2 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm sm:p-5">
      <div v-for="n in 8" :key="n" class="h-11 animate-pulse rounded-xl bg-zinc-100" />
    </div>

    <div
      v-else-if="data && !filteredContacts.length"
      class="flex flex-col items-center rounded-2xl border border-dashed border-zinc-200 bg-white px-6 py-16 text-center shadow-sm sm:py-20"
    >
      <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500">
        <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      </div>
      <h3 class="mt-5 text-lg font-semibold text-zinc-900">
        {{ data.contacts.length ? 'No matching contacts' : 'No contacts yet' }}
      </h3>
      <p class="mt-2 max-w-sm text-sm text-zinc-500">
        {{ data.contacts.length ? noMatchesHint : 'Contacts will appear here as they sync into your tenant.' }}
      </p>
    </div>

    <div v-else-if="data" class="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm shadow-zinc-950/[0.04]">
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="border-b border-zinc-200 bg-zinc-50/80">
            <tr>
              <th scope="col" class="whitespace-nowrap px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 sm:px-5">
                Name
              </th>
              <th scope="col" class="whitespace-nowrap px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 sm:px-5">
                Email
              </th>
              <th scope="col" class="whitespace-nowrap px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 sm:px-5">
                Kind
              </th>
              <th scope="col" class="hidden whitespace-nowrap px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 lg:table-cell lg:px-5">
                Company
              </th>
              <th scope="col" class="hidden whitespace-nowrap px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 md:table-cell md:px-5">
                Phone
              </th>
              <th scope="col" class="whitespace-nowrap px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 sm:px-5">
                Updated
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-zinc-100">
            <tr
              v-for="row in paginatedContacts"
              :key="row.id"
              class="bg-white transition hover:bg-zinc-50/80"
            >
              <td class="whitespace-nowrap px-4 py-3 font-medium text-zinc-900 sm:px-5">
                {{ row.name || '—' }}
              </td>
              <td class="max-w-[200px] truncate px-4 py-3 text-zinc-600 sm:max-w-xs sm:px-5" :title="row.email || undefined">
                {{ row.email || '—' }}
              </td>
              <td class="px-4 py-3 sm:px-5">
                <span
                  class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset"
                  :class="contactKindBadgeClass(row.contactKind)"
                >
                  {{ row.contactKindLabel }}
                </span>
              </td>
              <td class="hidden max-w-[180px] truncate px-4 py-3 text-zinc-600 lg:table-cell lg:px-5" :title="row.company || undefined">
                {{ row.company || '—' }}
              </td>
              <td class="hidden whitespace-nowrap px-4 py-3 text-zinc-600 md:table-cell md:px-5">
                {{ row.phone || '—' }}
              </td>
              <td class="whitespace-nowrap px-4 py-3 tabular-nums text-zinc-500 sm:px-5">
                {{ row.updatedAt ? formatDate(row.updatedAt) : '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        v-if="filteredContacts.length"
        class="flex flex-col gap-4 border-t border-zinc-200 bg-zinc-50/50 px-4 py-4 text-sm text-zinc-600 sm:flex-row sm:items-center sm:justify-between sm:px-5"
      >
        <p class="tabular-nums text-zinc-500">
          <span class="font-medium text-zinc-800">{{ paginationMeta.from }}–{{ paginationMeta.to }}</span>
          of {{ paginationMeta.total.toLocaleString() }}
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
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

function contactKindBadgeClass(kind: string): string {
  if (!kind.trim()) return 'bg-zinc-100 text-zinc-500 ring-zinc-200/80'
  const k = kind.toLowerCase()
  if (k.includes('prospect')) return 'bg-emerald-50 text-emerald-800 ring-emerald-200/80'
  if (k.includes('client')) return 'bg-sky-50 text-sky-800 ring-sky-200/80'
  if (k.includes('contact')) return 'bg-violet-50 text-violet-800 ring-violet-200/80'
  return 'bg-zinc-100 text-zinc-700 ring-zinc-200/80'
}

const PAGE_SIZE = 25

export interface TenantContactTypeOption {
  key: string
  label: string
  sortOrder: number
}

export interface ContactRow {
  id: string
  externalId: string
  source: string
  contactKind: string
  /** Resolved from `contact_types` when available. */
  contactKindLabel: string
  firstName: string
  lastName: string
  /** Display name: first + last (API-computed). */
  name: string
  email: string
  phone: string
  company: string
  channel: string
  address: {
    street: string
    city: string
    state: string
    county: string
  }
  createdAt: string | null
  updatedAt: string | null
}

interface ContactsIndexPayload {
  contacts: ContactRow[]
  contactTypes?: TenantContactTypeOption[]
  total: number
  truncated: boolean
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
const data = ref<ContactsIndexPayload | null>(null)
const searchQuery = ref('')
/** `'all'`, `'__none__'` (no kind), or lowercase contact type key. */
const contactKindFilter = ref('all')
const currentPage = ref(1)

const KIND_FILTER_NONE = '__none__'

const hasContactsWithoutKind = computed(() =>
  (data.value?.contacts ?? []).some((row) => !row.contactKind?.trim())
)

const contactTypeFilterOptions = computed(() => {
  const api = data.value?.contactTypes ?? []
  const ordered = [...api].sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key))
  const base = ordered.map((t) => ({ key: t.key, label: t.label }))
  const keysFromApi = new Set(base.map((o) => o.key.toLowerCase()))
  const extras: { key: string; label: string }[] = []
  for (const row of data.value?.contacts ?? []) {
    const raw = row.contactKind?.trim()
    if (!raw) continue
    const k = raw.toLowerCase()
    if (keysFromApi.has(k)) continue
    keysFromApi.add(k)
    extras.push({ key: k, label: row.contactKindLabel || raw })
  }
  extras.sort((a, b) => a.label.localeCompare(b.label))
  return [...base, ...extras]
})

const filteredContacts = computed(() => {
  let list = data.value?.contacts ?? []
  const kind = contactKindFilter.value
  if (kind !== 'all') {
    if (kind === KIND_FILTER_NONE) {
      list = list.filter((row) => !row.contactKind?.trim())
    } else {
      const k = kind.toLowerCase()
      list = list.filter(
        (row) => (row.contactKind?.trim().toLowerCase() ?? '') === k
      )
    }
  }
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return list
  return list.filter((row) => {
    const blob = [
      row.firstName,
      row.lastName,
      row.name,
      row.email,
      row.company,
      row.phone,
      row.contactKind,
      row.contactKindLabel
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return blob.includes(q)
  })
})

const noMatchesHint = computed(() => {
  const hasSearch = Boolean(searchQuery.value.trim())
  const hasKind = contactKindFilter.value !== 'all'
  if (hasSearch && hasKind) return 'Try a different search or contact type.'
  if (hasSearch) return 'Try a different search.'
  if (hasKind) return 'No contacts match this type. Try another type or choose “All types”.'
  return 'Try a different search or filter.'
})

const totalPages = computed(() =>
  Math.max(1, Math.ceil(filteredContacts.value.length / PAGE_SIZE))
)

const paginatedContacts = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return filteredContacts.value.slice(start, start + PAGE_SIZE)
})

const paginationMeta = computed(() => {
  const total = filteredContacts.value.length
  if (!total) return { from: 0, to: 0, total: 0 }
  const from = (currentPage.value - 1) * PAGE_SIZE + 1
  const to = Math.min(currentPage.value * PAGE_SIZE, total)
  return { from, to, total }
})

watch([searchQuery, contactKindFilter], () => {
  currentPage.value = 1
})

watch(totalPages, (pages) => {
  if (currentPage.value > pages) currentPage.value = pages
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

async function load() {
  pending.value = true
  loadError.value = ''
  try {
    const res = await $fetch<ContactsIndexPayload>('/api/v1/tenant/contacts', {
      credentials: 'include',
      ...serverAuthHeaders()
    })
    const contacts = (res.contacts ?? []).map((row) => ({
      ...row,
      contactKindLabel:
        row.contactKindLabel ??
        (row.contactKind ? row.contactKind : '—')
    }))
    data.value = {
      contacts,
      contactTypes: res.contactTypes ?? [],
      total: res.total ?? 0,
      truncated: res.truncated ?? false
    }
    if (
      !contacts.some((r) => !r.contactKind?.trim()) &&
      contactKindFilter.value === KIND_FILTER_NONE
    ) {
      contactKindFilter.value = 'all'
    }
  } catch (e: unknown) {
    loadError.value =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message ?? 'Failed to load contacts')
        : 'Failed to load contacts'
    data.value = null
  } finally {
    pending.value = false
  }
}

onMounted(() => {
  load()
})
</script>
