<template>
  <div class="min-h-screen bg-white">
    <div class="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] lg:px-8">
      <header class="mb-8">
        <h1 class="text-2xl font-bold tracking-tight text-slate-900">
          Contacts
        </h1>
        <p class="mt-1 text-sm text-slate-500">
          All contacts in your tenant database, newest updates first.
        </p>
      </header>

      <div
        v-if="loadError"
        class="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
      >
        {{ loadError }}
      </div>

      <div
        v-if="data?.truncated"
        class="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
      >
        Showing the {{ data.contacts.length }} most recently updated contacts.
        Total in database: <strong>{{ data.total }}</strong>.
      </div>

      <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div class="relative flex-1">
          <svg class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search name, email, company"
            class="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300"
          >
        </div>
        <p v-if="data" class="shrink-0 text-sm text-slate-600">
          <span class="font-medium text-slate-900">{{ data.total }}</span> total
          <span v-if="filteredContacts.length !== data.contacts.length" class="text-slate-500">
            · {{ filteredContacts.length }} matching
          </span>
        </p>
      </div>

      <div v-if="pending" class="space-y-2">
        <div v-for="n in 8" :key="n" class="h-12 animate-pulse rounded-lg bg-slate-100" />
      </div>

      <div
        v-else-if="data && !filteredContacts.length"
        class="rounded-xl border border-slate-200 bg-slate-50/50 px-8 py-16 text-center"
      >
        <p class="text-slate-600">
          {{ data.contacts.length ? 'No contacts match your search.' : 'No contacts yet.' }}
        </p>
      </div>

      <div v-else-if="data" class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead class="bg-slate-50">
              <tr>
                <th scope="col" class="px-4 py-3 font-semibold text-slate-700">
                  Name
                </th>
                <th scope="col" class="px-4 py-3 font-semibold text-slate-700">
                  Email
                </th>
                <th scope="col" class="px-4 py-3 font-semibold text-slate-700">
                  Kind
                </th>
                <th scope="col" class="hidden px-4 py-3 font-semibold text-slate-700 lg:table-cell">
                  Company
                </th>
                <th scope="col" class="hidden px-4 py-3 font-semibold text-slate-700 md:table-cell">
                  Phone
                </th>
                <th scope="col" class="px-4 py-3 font-semibold text-slate-700">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="row in paginatedContacts"
                :key="row.id"
                class="hover:bg-slate-50/80"
              >
                <td class="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                  {{ row.name || '—' }}
                </td>
                <td class="max-w-[200px] truncate px-4 py-3 text-slate-700" :title="row.email">
                  {{ row.email || '—' }}
                </td>
                <td class="px-4 py-3">
                  <span class="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-800">
                    {{ row.contactKind }}
                  </span>
                </td>
                <td class="hidden max-w-[180px] truncate px-4 py-3 text-slate-600 lg:table-cell" :title="row.company">
                  {{ row.company || '—' }}
                </td>
                <td class="hidden whitespace-nowrap px-4 py-3 text-slate-600 md:table-cell">
                  {{ row.phone || '—' }}
                </td>
                <td class="whitespace-nowrap px-4 py-3 text-slate-500">
                  {{ row.updatedAt ? formatDate(row.updatedAt) : '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div
          v-if="filteredContacts.length"
          class="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between"
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

const PAGE_SIZE = 25

export interface ContactRow {
  id: string
  externalId: string
  source: string
  contactKind: string
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
const currentPage = ref(1)

const filteredContacts = computed(() => {
  const list = data.value?.contacts ?? []
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return list
  return list.filter((row) => {
    const blob = [row.name, row.email, row.company, row.phone, row.contactKind]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return blob.includes(q)
  })
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

watch([searchQuery], () => {
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
    data.value = {
      contacts: res.contacts ?? [],
      total: res.total ?? 0,
      truncated: res.truncated ?? false
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
