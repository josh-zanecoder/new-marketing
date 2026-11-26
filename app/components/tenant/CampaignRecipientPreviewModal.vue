<script setup lang="ts">
/**
 * Pop-up list of everyone a campaign would be sent to (search, pages, live refresh).
 * The parent supplies `load`, so the same modal serves filters, lists and manual picks.
 * It reloads whenever `refreshKey` changes while open, so it always shows the current audience.
 */
import { Search, X, RefreshCw, Users } from 'lucide-vue-next'
import { borrowerStatusLabel } from '~~/shared/utils/borrowerStatusLabel'
import {
  recipientAvatarTone,
  recipientInitials,
  recipientStatusTone
} from '~/utils/recipientDisplay'

export interface RecipientPreviewRow {
  id: string
  name: string
  email: string
  status?: string
  city?: string
  state?: string
}

export interface RecipientPreviewPage {
  total: number
  contacts: RecipientPreviewRow[]
}

const props = withDefaults(
  defineProps<{
    open: boolean
    title?: string
    /** Fetches one page; `search` is the text in the search box (empty = everyone). */
    load: (args: { page: number, limit: number, search: string }) => Promise<RecipientPreviewPage>
    /** Change this to reload while the modal is open (e.g. the filters changed). */
    refreshKey?: string | number
    pageSize?: number
  }>(),
  { title: 'Recipients', refreshKey: '', pageSize: 50 }
)

const emit = defineEmits<{ close: [] }>()

const rows = ref<RecipientPreviewRow[]>([])
const total = ref(0)
const page = ref(1)
const search = ref('')
const pending = ref(false)
const error = ref('')
/** Total with no search applied, so the header still shows the real audience while searching. */
const audienceTotal = ref<number | null>(null)
const loadedAt = ref<Date | null>(null)
let seq = 0
let searchTimer: ReturnType<typeof setTimeout> | null = null

const pageCount = computed(() => Math.max(1, Math.ceil(total.value / props.pageSize)))
const rangeFrom = computed(() => (total.value === 0 ? 0 : (page.value - 1) * props.pageSize + 1))
const rangeTo = computed(() => Math.min(total.value, page.value * props.pageSize))
const loadedAtLabel = computed(() =>
  loadedAt.value
    ? loadedAt.value.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })
    : ''
)

async function fetchPage() {
  const mine = ++seq
  pending.value = true
  error.value = ''
  try {
    const res = await props.load({
      page: page.value,
      limit: props.pageSize,
      search: search.value.trim()
    })
    if (mine !== seq) return
    rows.value = res.contacts
    total.value = res.total
    if (!search.value.trim()) audienceTotal.value = res.total
    loadedAt.value = new Date()
    // The audience shrank while the modal was open: land on the last page that still exists.
    const last = Math.max(1, Math.ceil(res.total / props.pageSize))
    if (page.value > last) {
      page.value = last
      void fetchPage()
    }
  } catch (e: unknown) {
    if (mine !== seq) return
    error.value =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message ?? 'Could not load recipients')
        : 'Could not load recipients'
    rows.value = []
    total.value = 0
  } finally {
    if (mine === seq) pending.value = false
  }
}

function goToPage(next: number) {
  const clamped = Math.min(pageCount.value, Math.max(1, next))
  if (clamped === page.value) return
  page.value = clamped
  void fetchPage()
}

function reset() {
  seq += 1
  rows.value = []
  total.value = 0
  audienceTotal.value = null
  page.value = 1
  search.value = ''
  error.value = ''
  pending.value = false
}

watch(search, () => {
  if (!props.open) return
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    void fetchPage()
  }, 300)
})

// Live: re-read the audience whenever the parent says it changed.
watch(
  () => props.refreshKey,
  () => {
    if (props.open) void fetchPage()
  }
)

let escListener: ((e: KeyboardEvent) => void) | null = null

function detach() {
  if (escListener) {
    window.removeEventListener('keydown', escListener)
    escListener = null
  }
  document.body.style.overflow = ''
}

watch(
  () => props.open,
  (open) => {
    if (!import.meta.client) return
    detach()
    if (!open) {
      reset()
      return
    }
    document.body.style.overflow = 'hidden'
    escListener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') emit('close')
    }
    window.addEventListener('keydown', escListener)
    void fetchPage()
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
  if (import.meta.client) detach()
})

function place(row: RecipientPreviewRow): string {
  return [row.city, row.state].filter(Boolean).join(', ')
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-md sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      @click.self="emit('close')"
    >
      <div class="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-w-3xl sm:rounded-2xl">
        <div class="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
            <Users class="h-5 w-5" />
          </span>
          <div class="min-w-0 flex-1">
            <h2 class="truncate text-base font-semibold text-slate-900">
              {{ title }}
            </h2>
            <p class="text-sm tabular-nums text-slate-500">
              <template v-if="audienceTotal !== null">
                {{ audienceTotal.toLocaleString() }} recipient{{ audienceTotal === 1 ? '' : 's' }}
              </template>
              <template v-else>
                Loading…
              </template>
              <span
                v-if="loadedAtLabel"
                class="text-slate-400"
              > · updated {{ loadedAtLabel }}</span>
            </p>
          </div>
          <button
            type="button"
            class="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            :disabled="pending"
            aria-label="Refresh recipients"
            title="Refresh"
            @click="fetchPage()"
          >
            <RefreshCw
              class="h-4 w-4"
              :class="pending ? 'animate-spin' : ''"
            />
          </button>
          <button
            type="button"
            class="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
            aria-label="Close"
            @click="emit('close')"
          >
            <X class="h-5 w-5" />
          </button>
        </div>

        <div class="border-b border-slate-100 px-5 py-3">
          <label class="relative block">
            <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              v-model="search"
              type="search"
              placeholder="Search by name or email"
              class="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            >
          </label>
        </div>

        <div
          class="min-h-[16rem] flex-1 overflow-y-auto overscroll-contain"
          aria-live="polite"
        >
          <p
            v-if="error"
            class="px-5 py-10 text-center text-sm text-red-700"
          >
            {{ error }}
          </p>
          <p
            v-else-if="pending && !rows.length"
            class="px-5 py-10 text-center text-sm text-slate-500"
          >
            Loading recipients…
          </p>
          <p
            v-else-if="!rows.length"
            class="px-5 py-10 text-center text-sm text-slate-500"
          >
            {{ search.trim() ? 'No recipients match your search.' : 'No recipients yet.' }}
          </p>
          <ul
            v-else
            class="divide-y divide-slate-100 transition-opacity"
            :class="pending ? 'opacity-60' : ''"
          >
            <li
              v-for="c in rows"
              :key="c.id"
              class="flex items-center gap-3 px-5 py-2.5 text-sm"
            >
              <span
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                :class="recipientAvatarTone(c.email || c.name)"
              >{{ recipientInitials(c.name || c.email) }}</span>
              <span class="min-w-0 flex-1">
                <span class="block truncate font-medium text-slate-900">{{ c.name || c.email }}</span>
                <span class="block truncate text-xs text-slate-500">{{ c.email }}</span>
              </span>
              <span
                v-if="place(c)"
                class="hidden shrink-0 text-xs text-slate-400 sm:block"
              >{{ place(c) }}</span>
              <span
                v-if="c.status"
                class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                :class="recipientStatusTone(c.status).badge"
              >
                <span
                  class="h-1.5 w-1.5 rounded-full"
                  :class="recipientStatusTone(c.status).dot"
                />
                {{ borrowerStatusLabel(c.status) }}
              </span>
            </li>
          </ul>
        </div>

        <div class="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
          <p class="text-xs tabular-nums text-slate-500">
            <template v-if="total > 0">
              {{ rangeFrom.toLocaleString() }}–{{ rangeTo.toLocaleString() }} of {{ total.toLocaleString() }}
              <span v-if="search.trim()"> matching “{{ search.trim() }}”</span>
            </template>
          </p>
          <div class="flex items-center gap-1.5">
            <button
              type="button"
              class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="page <= 1 || pending"
              @click="goToPage(page - 1)"
            >
              Previous
            </button>
            <button
              type="button"
              class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="page >= pageCount || pending"
              @click="goToPage(page + 1)"
            >
              Next
            </button>
            <button
              type="button"
              class="ml-1 rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              @click="emit('close')"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
