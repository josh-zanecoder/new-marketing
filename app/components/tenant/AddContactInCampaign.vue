<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-campaign-contacts-title"
    >
      <div
        class="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]"
        aria-hidden="true"
        @click="close"
      />
      <div
        class="relative flex max-h-[min(92dvh,800px)] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/25 ring-1 ring-slate-900/[0.04] sm:max-h-[min(85vh,800px)] sm:rounded-2xl"
        @click.stop
      >
        <div
          class="flex shrink-0 justify-center pt-2.5 sm:hidden"
          aria-hidden="true"
        >
          <span class="h-1 w-10 rounded-full bg-slate-200" />
        </div>
        <div class="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
          <div class="min-w-0">
            <h2 id="add-campaign-contacts-title" class="text-base font-semibold text-slate-900 sm:text-lg">
              Add contacts
            </h2>
            <p class="mt-1 text-xs text-slate-500 sm:text-sm">
              Search your CRM and add people with an email to this campaign.
            </p>
          </div>
          <button
            type="button"
            class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 sm:border-0 sm:bg-transparent sm:shadow-none"
            aria-label="Close"
            @click="close"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="flex shrink-0 flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:px-5">
          <label class="sr-only" for="modal-contact-search">Search contacts</label>
          <input
            id="modal-contact-search"
            v-model="searchQuery"
            type="search"
            autocomplete="off"
            placeholder="Search by name or email…"
            class="min-w-0 w-full flex-1 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-[3px] focus:ring-indigo-500/20 sm:min-w-[12rem] sm:basis-[14rem]"
          >
          <div class="grid grid-cols-1 gap-2 min-[420px]:grid-cols-[1fr_auto] sm:contents">
            <div class="relative min-w-0 sm:min-w-[11rem]">
              <label class="sr-only" for="modal-contact-type">Contact type</label>
              <select
                id="modal-contact-type"
                v-model="typeFilter"
                class="w-full cursor-pointer appearance-none rounded-xl border border-slate-200/90 bg-white py-2.5 pl-3 pr-10 text-sm text-slate-800 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] focus:border-indigo-300 focus:outline-none focus:ring-[3px] focus:ring-indigo-500/20"
              >
                <option value="all">
                  All types
                </option>
                <option
                  v-for="opt in typeFilterSelectOptions"
                  :key="opt.key"
                  :value="opt.key"
                >
                  {{ typeOptionDisplay(opt) }}
                </option>
              </select>
              <svg
                class="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <button
              type="button"
              class="inline-flex w-full shrink-0 items-center justify-center whitespace-nowrap rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] transition hover:border-indigo-200 hover:bg-indigo-50/80 disabled:opacity-50 min-[420px]:w-auto sm:ml-auto"
              :disabled="pending"
              @click="$emit('refresh')"
            >
              Refresh
            </button>
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-2 sm:px-5 sm:py-3">
          <p v-if="error" class="py-4 text-sm text-red-600" role="alert">
            {{ error }}
          </p>
          <div
            v-else-if="pending"
            class="py-10 text-center text-sm text-slate-500"
          >
            Loading contacts…
          </div>
          <template v-else>
            <p
              v-if="truncated"
              class="mb-3 rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900"
              role="status"
            >
              Showing recently updated contacts only (list is capped). Refine your search or use a recipient list for larger audiences.
            </p>
            <p
              v-if="!filteredRows.length"
              class="py-8 text-center text-sm text-slate-500"
            >
              {{
                searchQuery.trim()
                  ? 'No contacts match your search.'
                  : typeFilter !== 'all'
                    ? 'No contacts of this type with an email. Try a different type or clear the filter.'
                    : 'No contacts with an email address yet.'
              }}
            </p>
            <ul v-else class="space-y-2 sm:divide-y sm:divide-slate-100 sm:space-y-0">
              <li
                v-for="c in filteredRows"
                :key="c.id"
                class="flex flex-col gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/40 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:py-3"
              >
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-semibold text-slate-900">
                    {{ c.name || '—' }}
                  </p>
                  <p class="mt-0.5 break-all text-sm text-slate-500 sm:truncate">
                    {{ c.email }}
                  </p>
                  <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <p v-if="c.company" class="max-w-full truncate text-xs text-slate-400">
                      {{ c.company }}
                    </p>
                    <span
                      v-for="tag in contactTypeTags(c)"
                      :key="tag"
                      class="inline-flex shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold capitalize leading-none text-slate-600 ring-1 ring-slate-200/80"
                    >
                      {{ tag }}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  class="inline-flex w-full shrink-0 items-center justify-center whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/80 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:py-1.5 sm:text-xs"
                  :disabled="isSelected(c.id)"
                  @click="emit('addContact', c)"
                >
                  {{ isSelected(c.id) ? 'Added' : 'Add' }}
                </button>
              </li>
            </ul>
          </template>
        </div>

        <div class="shrink-0 border-t border-slate-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:px-5 sm:pb-3">
          <button
            type="button"
            class="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 transition hover:bg-indigo-700 sm:ml-auto sm:w-auto"
            @click="close"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { CampaignContactPickerRow, TenantContactTypeOption } from '~/types/tenantContact'

const props = defineProps<{
  contacts: CampaignContactPickerRow[]
  pending: boolean
  error: string
  truncated: boolean
  /** Per-key counts from GET recipient-list (any keys the API returns). */
  typeCounts: Record<string, number> | null
  /** Tenant registry rows; drives filter labels and order. When empty, keys are inferred from `contacts`. */
  typeOptions: TenantContactTypeOption[]
  selectedIds: string[]
}>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  refresh: []
  addContact: [row: CampaignContactPickerRow]
}>()

const searchQuery = ref('')
const typeFilter = ref('all')

let escListener: ((e: KeyboardEvent) => void) | null = null

watch(open, (isOpen) => {
  if (!import.meta.client) return

  document.body.style.overflow = isOpen ? 'hidden' : ''

  if (escListener) {
    window.removeEventListener('keydown', escListener)
    escListener = null
  }

  if (isOpen) {
    searchQuery.value = ''
    typeFilter.value = 'all'
    escListener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', escListener)
  }
})

onBeforeUnmount(() => {
  if (!import.meta.client) return
  document.body.style.overflow = ''
  if (escListener) {
    window.removeEventListener('keydown', escListener)
    escListener = null
  }
})

function close() {
  open.value = false
}

function isSelected(contactId: string): boolean {
  const id = String(contactId ?? '').trim()
  return id ? props.selectedIds.includes(id) : false
}

const keysFromContacts = computed(() => {
  const s = new Set<string>()
  for (const c of props.contacts) {
    for (const raw of c.contactType ?? []) {
      const k = String(raw).trim().toLowerCase()
      if (k) s.add(k)
    }
  }
  return [...s].sort((a, b) => a.localeCompare(b))
})

const typeFilterSelectOptions = computed((): { key: string; label: string }[] => {
  const registry = props.typeOptions ?? []
  if (registry.length) {
    const rows = registry
      .filter((t) => t.enabled !== false)
      .map((t) => {
        const key = t.key.trim().toLowerCase()
        return {
          key,
          label: (t.label || t.key).trim() || key,
          sortOrder: Number(t.sortOrder ?? 0)
        }
      })
      .filter((t) => t.key)
    rows.sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key))
    return rows.map(({ key, label }) => ({ key, label }))
  }
  return keysFromContacts.value.map((key) => ({ key, label: key }))
})

function typeOptionDisplay(opt: { key: string; label: string }): string {
  const n = props.typeCounts?.[opt.key]
  const suffix = typeof n === 'number' && Number.isFinite(n) ? ` (${n.toLocaleString()})` : ''
  return `${opt.label}${suffix}`
}

function contactTypeTags(c: CampaignContactPickerRow): string[] {
  const keys = (c.contactType ?? []).map((k) => String(k).trim().toLowerCase()).filter(Boolean)
  return keys.length ? [...new Set(keys)] : []
}

const filteredRows = computed(() => {
  let rows = props.contacts
  const t = typeFilter.value
  if (t !== 'all') {
    const want = t.trim().toLowerCase()
    rows = rows.filter((c) =>
      (c.contactType ?? []).some((x) => String(x).trim().toLowerCase() === want)
    )
  }
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return rows
  return rows.filter((c) => {
    const name = c.name.toLowerCase()
    const email = c.email.toLowerCase()
    const company = (c.company ?? '').toLowerCase()
    return name.includes(q) || email.includes(q) || company.includes(q)
  })
})
</script>
