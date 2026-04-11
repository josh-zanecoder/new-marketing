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
        class="absolute inset-0 bg-zinc-950/55 backdrop-blur-[2px]"
        aria-hidden="true"
        @click="close"
      />
      <div
        class="relative flex max-h-[min(92vh,800px)] w-full max-w-4xl flex-col rounded-t-2xl bg-white shadow-2xl ring-1 ring-zinc-200/90 sm:max-h-[85vh] sm:rounded-2xl"
      >
        <div class="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-100 px-4 py-4 sm:px-5 sm:py-4">
          <div class="min-w-0">
            <h2 id="add-campaign-contacts-title" class="text-lg font-semibold text-zinc-900">
              Add contacts
            </h2>
            <p class="mt-1 text-sm text-zinc-500">
              Search your CRM and add people with an email to this campaign.
            </p>
          </div>
          <button
            type="button"
            class="shrink-0 rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800"
            aria-label="Close"
            @click="close"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="flex shrink-0 flex-col gap-3 border-b border-zinc-100 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:px-5">
          <label class="sr-only" for="modal-contact-search">Search contacts</label>
          <input
            id="modal-contact-search"
            v-model="searchQuery"
            type="search"
            autocomplete="off"
            placeholder="Search by name or email…"
            class="min-w-0 w-full flex-1 rounded-lg border border-zinc-200/90 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 sm:min-w-[12rem] sm:basis-[14rem]"
          >
          <label class="sr-only" for="modal-contact-type">Contact type</label>
          <select
            id="modal-contact-type"
            v-model="typeFilter"
            class="w-full shrink-0 rounded-lg border border-zinc-200/90 bg-white px-3 py-2 text-sm text-zinc-800 shadow-sm focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 sm:w-auto sm:min-w-[11rem]"
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
          <button
            type="button"
            class="shrink-0 rounded-lg border border-zinc-200/90 bg-white px-3 py-2 text-xs font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:opacity-50 sm:ml-auto"
            :disabled="pending"
            @click="$emit('refresh')"
          >
            Refresh
          </button>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-4 py-2 sm:px-5 sm:py-3">
          <p v-if="error" class="py-4 text-sm text-red-600">
            {{ error }}
          </p>
          <div
            v-else-if="pending"
            class="py-10 text-center text-sm text-zinc-500"
          >
            Loading contacts…
          </div>
          <template v-else>
            <p
              v-if="truncated"
              class="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200/80"
            >
              Showing recently updated contacts only (list is capped). Refine your search or use a recipient list for larger audiences.
            </p>
            <p
              v-if="!filteredRows.length"
              class="py-8 text-center text-sm text-zinc-500"
            >
              {{
                searchQuery.trim()
                  ? 'No contacts match your search.'
                  : typeFilter !== 'all'
                    ? 'No contacts of this type with an email. Try a different type or clear the filter.'
                    : 'No contacts with an email address yet.'
              }}
            </p>
            <ul v-else class="divide-y divide-zinc-100">
              <li
                v-for="c in filteredRows"
                :key="c.id"
                class="flex items-center justify-between gap-3 py-3"
              >
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-zinc-900">
                    {{ c.name || '—' }}
                  </p>
                  <p class="truncate text-sm text-zinc-500">
                    {{ c.email }}
                  </p>
                  <div class="flex flex-wrap items-center gap-2">
                    <p v-if="c.company" class="truncate text-xs text-zinc-400">
                      {{ c.company }}
                    </p>
                    <span
                      v-for="tag in contactTypeTags(c)"
                      :key="tag"
                      class="inline-flex shrink-0 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold capitalize leading-none text-zinc-600 ring-1 ring-zinc-200/80"
                    >
                      {{ tag }}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  class="shrink-0 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="isSelected(c.id)"
                  @click="emit('addContact', c)"
                >
                  {{ isSelected(c.id) ? 'Added' : 'Add' }}
                </button>
              </li>
            </ul>
          </template>
        </div>

        <div class="shrink-0 border-t border-zinc-100 px-4 py-3 sm:flex sm:justify-end sm:px-5">
          <button
            type="button"
            class="w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 sm:w-auto"
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

watch(open, (isOpen) => {
  if (isOpen) {
    searchQuery.value = ''
    typeFilter.value = 'all'
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
