<template>
  <div class="w-full min-w-0">
    <div class="mx-auto w-full max-w-3xl">
      <NuxtLink
        :to="`/tenant/recipient-list/${listId}`"
        class="group mb-8 inline-flex items-center gap-2 text-sm font-medium text-zinc-600 transition hover:text-zinc-900"
      >
        <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100/80 text-zinc-500 transition group-hover:bg-zinc-200/80 group-hover:text-zinc-800">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </span>
        Back to list
      </NuxtLink>

      <header class="mb-8 sm:mb-10">
        <h1 class="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
          Edit recipient list
        </h1>
        <p class="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500 sm:text-[15px]">
          Update the audience, filters, or name. Saving refreshes who’s on the list.
        </p>
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
            Your tenant has no <strong class="font-semibold">tenant ID</strong> in the registry. You can still save audience-only lists;
            admin-defined recipient filters appear once a tenant ID is set.
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

      <div v-if="loadPending" class="mb-8 space-y-4 rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm">
        <div class="h-10 max-w-sm animate-pulse rounded-xl bg-zinc-100" />
        <div class="h-12 w-full animate-pulse rounded-xl bg-zinc-100" />
        <div class="h-32 animate-pulse rounded-xl bg-zinc-50" />
      </div>

      <form
        v-else-if="data"
        class="space-y-6"
        @submit.prevent="submitUpdate"
      >
        <div class="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm shadow-zinc-950/[0.04]">
          <div class="border-b border-zinc-100 px-5 py-4 sm:px-6">
            <h2 class="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Details
            </h2>
          </div>
          <div class="space-y-6 p-5 sm:p-6">
            <div>
              <label for="rl-name" class="mb-2 block text-sm font-medium text-zinc-700">List name</label>
              <input
                id="rl-name"
                v-model="form.name"
                type="text"
                required
                maxlength="200"
                placeholder="e.g. Texas prospects"
                class="w-full rounded-xl border border-zinc-200/90 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 sm:text-[15px]"
              >
            </div>

            <div>
              <label for="rl-audience" class="mb-2 block text-sm font-medium text-zinc-700">Audience</label>
              <select
                id="rl-audience"
                v-model="form.audience"
                class="w-full rounded-xl border border-zinc-200/90 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-500 sm:text-[15px]"
                :disabled="!audienceOptions.length"
                required
              >
                <option v-if="!audienceOptions.length" disabled value="">
                  No audiences from filters
                </option>
                <option
                  v-for="opt in audienceOptions"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </option>
              </select>
              <p
                v-if="data.tenantIdConfigured && !audienceOptions.length"
                class="mt-2 text-sm text-zinc-500"
              >
                Add at least one recipient filter in admin (per contact type) to choose an audience here.
              </p>
            </div>
          </div>

          <div class="border-t border-zinc-100 bg-zinc-50/50 px-5 py-4 sm:px-6">
            <h2 class="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Filters
            </h2>
            <p class="mt-1 text-sm text-zinc-500">
              Optional rules from your registry. Leave empty for audience-only lists.
            </p>
          </div>
          <div class="space-y-5 p-5 sm:p-6">
            <p
              v-if="data.tenantIdConfigured && !filtersForAudience.length"
              class="rounded-xl bg-zinc-50/80 px-4 py-3 text-sm text-zinc-600 ring-1 ring-zinc-200/60"
            >
              No enabled recipient filters for this audience. Ask an admin to add filters, or save with audience only.
            </p>

            <div
              v-for="(row, idx) in form.filterRows"
              :key="idx"
              class="space-y-3"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <label
                  :for="`rl-filter-${idx}`"
                  class="text-sm font-medium text-zinc-800"
                >
                  {{ idx === 0 ? 'Filter' : `Filter ${idx + 1}` }}
                </label>
                <button
                  type="button"
                  class="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 sm:text-sm"
                  @click="removeFilterRow(idx)"
                >
                  <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Remove
                </button>
              </div>

              <template v-if="!row.recipientFilterId">
                <select
                  :id="`rl-filter-${idx}`"
                  v-model="row.recipientFilterId"
                  required
                  class="w-full rounded-xl border border-zinc-200/90 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 sm:text-[15px]"
                  @change="onRowFilterChange(row)"
                >
                  <option disabled value="">
                    Choose a filter
                  </option>
                  <option
                    v-for="f in selectableFiltersForRow(idx)"
                    :key="f.id"
                    :value="f.id"
                  >
                    {{ filterOptionLabel(f) }}
                  </option>
                </select>
              </template>

              <div
                v-else
                class="rounded-xl bg-zinc-50/90 px-4 py-4 ring-1 ring-zinc-200/70 sm:px-5 sm:py-5"
              >
                <p class="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  Match rule
                </p>
                <div
                  class="grid grid-cols-1 items-center gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.25fr)] sm:gap-3"
                >
                  <div class="min-w-0">
                    <select
                      :id="`rl-filter-${idx}`"
                      v-model="row.recipientFilterId"
                      class="w-full rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 sm:text-[15px]"
                      @change="onRowFilterChange(row)"
                    >
                      <option
                        v-for="f in selectableFiltersForRow(idx)"
                        :key="f.id"
                        :value="f.id"
                      >
                        {{ filterOptionLabel(f) }}
                      </option>
                    </select>
                  </div>
                  <div class="flex justify-center sm:px-1">
                    <span class="rounded-md bg-zinc-200/60 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                      equals
                    </span>
                  </div>
                  <div class="min-w-0">
                    <template v-if="showPropertyRowFor(row) && rowRegistryTokens(row).length > 1">
                      <select
                        :id="`rl-list-property-value-${idx}`"
                        v-model="row.listPropertyValue"
                        required
                        class="w-full rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 sm:text-[15px]"
                      >
                        <option disabled value="">
                          Select a value
                        </option>
                        <option
                          v-for="opt in rowRegistryTokens(row)"
                          :key="opt"
                          :value="opt"
                        >
                          {{ opt }}
                        </option>
                      </select>
                    </template>
                    <p
                      v-else-if="showPropertyRowFor(row) && rowRegistryTokens(row).length === 1"
                      class="break-words rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm sm:text-[15px]"
                    >
                      {{ rowRegistryTokens(row)[0] }}
                    </p>
                    <input
                      v-else-if="showPropertyRowFor(row)"
                      :id="`rl-list-property-value-${idx}`"
                      v-model="row.listPropertyValue"
                      type="text"
                      required
                      maxlength="2000"
                      class="w-full rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 sm:text-[15px]"
                      :placeholder="propertyValuePlaceholderFor(row)"
                    >
                  </div>
                </div>
              </div>
            </div>

            <button
              v-if="filtersForAudience.length && canAddFilter"
              type="button"
              class="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-3.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 sm:text-[15px]"
              @click="addFilterRow"
            >
              <svg class="h-4 w-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              {{ form.filterRows.length ? 'Add another filter' : 'Add filter' }}
            </button>

            <div v-if="showCombineCriteria" class="border-t border-zinc-100 pt-5">
              <label for="rl-filter-mode" class="mb-2 block text-sm font-medium text-zinc-700">
                Combine criteria
              </label>
              <select
                id="rl-filter-mode"
                v-model="form.filterMode"
                class="w-full rounded-xl border border-zinc-200/90 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 sm:text-[15px]"
              >
                <option value="and">
                  AND — must match all conditions
                </option>
                <option value="or">
                  OR — match any one of the conditions
                </option>
              </select>
              <p class="mt-2 text-xs leading-relaxed text-zinc-500 sm:text-sm">
                <span class="font-medium text-zinc-700">AND</span> requires every rule to match.
                <span class="font-medium text-zinc-700">OR</span> matches if any rule matches.
              </p>
            </div>
          </div>
        </div>

        <div
          v-if="saveError"
          class="flex gap-3 rounded-2xl border border-red-200/80 bg-red-50 px-4 py-3.5 text-sm text-red-900"
          role="alert"
        >
          {{ saveError }}
        </div>

        <div class="flex flex-col-reverse items-stretch gap-3 pt-2 sm:flex-row sm:justify-end sm:gap-3">
          <NuxtLink
            :to="`/tenant/recipient-list/${listId}`"
            class="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-5 py-3 text-center text-sm font-medium text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 sm:text-[15px]"
            :class="{ 'pointer-events-none opacity-50': saving }"
          >
            Cancel
          </NuxtLink>
          <button
            type="submit"
            class="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-zinc-900/20 transition hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:opacity-50 sm:px-8 sm:text-[15px]"
            :disabled="saving || !canSubmitPropertyValue || !audienceOptions.length"
          >
            {{ saving ? 'Saving…' : 'Save changes' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">

definePageMeta({ layout: 'default' })

interface RegistryFilterRow {
  id: string
  name: string
  contactType: string
  property: string
  propertyType: string
  propertyValue: string
  enabled: boolean
}

interface RecipientListFormPayload {
  tenantIdConfigured: boolean
  contactCounts: Record<string, number>
  recipientFilters: RegistryFilterRow[]
}

interface FilterRow {
  recipientFilterId: string
  listPropertyValue: string
}

interface ListDetailForEdit {
  list: {
    name: string
    audience: string
    filterMode?: 'and' | 'or'
    filterRows?: { recipientFilterId: string; listPropertyValue: string }[]
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

const loadPending = ref(true)
const loadError = ref('')
const saveError = ref('')
const saving = ref(false)
const data = ref<RecipientListFormPayload | null>(null)
const skipAudienceClear = ref(true)

const form = reactive({
  name: '',
  audience: '',
  filterRows: [] as FilterRow[],
  filterMode: 'and' as 'and' | 'or'
})

/** Distinct `contactType` values from enabled registry filters (source of truth for audience). */
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

watch(
  audienceOptions,
  (opts) => {
    if (!opts.length) {
      form.audience = ''
      return
    }
    if (!opts.some((o) => o.value === form.audience)) {
      form.audience = opts[0]?.value ?? ''
    }
  },
  { immediate: true }
)

const filtersForAudience = computed(() => {
  const d = data.value
  if (!d) return []
  return d.recipientFilters.filter(
    (f) => f.contactType === form.audience && f.enabled
  )
})

/** Every registry filter for this audience — same row type can be chosen more than once (e.g. two Channel rules). */
function selectableFiltersForRow(_rowIdx: number): RegistryFilterRow[] {
  return filtersForAudience.value
}

/** Show Add filter while this audience has at least one registry filter to attach. */
const canAddFilter = computed(() => filtersForAudience.value.length > 0)

function rowFilter(row: FilterRow): RegistryFilterRow | null {
  const id = row.recipientFilterId
  if (!id) return null
  return filtersForAudience.value.find((f) => f.id === id) ?? null
}

function showPropertyRowFor(row: FilterRow): boolean {
  const f = rowFilter(row)
  return f != null && f.property !== 'none'
}

function tokenizePropertyValue(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function rowRegistryTokens(row: FilterRow): string[] {
  const f = rowFilter(row)
  if (!f || f.property === 'none') return []
  return tokenizePropertyValue(f.propertyValue ?? '')
}

function propertyValuePlaceholderFor(row: FilterRow): string {
  const f = rowFilter(row)
  if (!f) return 'Value'
  if (f.property === 'source') return 'e.g. webinar, import'
  if (f.property === 'address' && f.propertyType === 'county') {
    return 'e.g. Suffolk'
  }
  if (f.property === 'address' && f.propertyType === 'state') {
    return 'e.g. TX'
  }
  return 'Enter value to match'
}

/** At least two filter rows with a selected registry filter — then AND/OR matters. */
const showCombineCriteria = computed(
  () =>
    form.filterRows.filter((r) => String(r.recipientFilterId ?? '').trim()).length >= 2
)

const canSubmitPropertyValue = computed(() => {
  for (const row of form.filterRows) {
    if (!row.recipientFilterId.trim()) return false
    const f = rowFilter(row)
    if (!f || f.property === 'none') continue
    const tokens = rowRegistryTokens(row)
    if (tokens.length > 1) {
      if (!row.listPropertyValue.trim()) return false
    } else if (tokens.length === 1) {
      /* preset single value ok */
    } else {
      if (!row.listPropertyValue.trim()) return false
    }
  }
  return true
})

watch(
  () => form.audience,
  () => {
    if (skipAudienceClear.value) return
    form.filterRows = []
  }
)

function onRowFilterChange(row: FilterRow) {
  row.listPropertyValue = ''
  const f = rowFilter(row)
  if (!f || f.property === 'none') return
  const tokens = tokenizePropertyValue(f.propertyValue ?? '')
  if (tokens.length === 1) {
    row.listPropertyValue = tokens[0] ?? ''
  }
  if (tokens.length > 1) {
    const first = tokens[0] ?? ''
    row.listPropertyValue = first
  }
}

function addFilterRow() {
  form.filterRows.push({ recipientFilterId: '', listPropertyValue: '' })
}

function removeFilterRow(idx: number) {
  form.filterRows.splice(idx, 1)
}

const PROPERTY_FIELD_LABELS: Record<string, string> = {
  none: 'None',
  address: 'Address',
  channel: 'Channel',
  company: 'Company',
  source: 'Source',
  email: 'Email'
}

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  none: '',
  state: 'State',
  city: 'City',
  county: 'County',
  street: 'Street'
}

function propertyFieldLabel(property: string): string {
  return PROPERTY_FIELD_LABELS[property] ?? property
}

function propertyTypeLabel(propertyType: string): string {
  return PROPERTY_TYPE_LABELS[propertyType] ?? propertyType
}

/** Filter dropdown: only property + property type labels (no name, no values). */
function filterOptionLabel(f: RegistryFilterRow): string {
  if (f.property === 'none') return 'None'
  const prop = propertyFieldLabel(f.property)
  const typeOk = Boolean(f.propertyType && f.propertyType !== 'none')
  if (typeOk) {
    return `${prop} · ${propertyTypeLabel(f.propertyType)}`
  }
  return prop
}

function hydrateFromList(list: ListDetailForEdit['list']) {
  form.name = list.name ?? ''
  form.audience = list.audience ?? ''
  form.filterMode = list.filterMode === 'or' ? 'or' : 'and'
  const rows = list.filterRows?.length
    ? list.filterRows.map((r) => ({
        recipientFilterId: String(r.recipientFilterId ?? '').trim(),
        listPropertyValue: String(r.listPropertyValue ?? '').trim()
      }))
    : []
  form.filterRows = rows
  for (const row of form.filterRows) {
    const f = rowFilter(row)
    if (!f || f.property === 'none') continue
    const tokens = tokenizePropertyValue(f.propertyValue ?? '')
    if (!row.listPropertyValue.trim() && tokens.length === 1) {
      row.listPropertyValue = tokens[0] ?? ''
    }
  }
}

async function loadAll() {
  const id = listId.value
  loadPending.value = true
  loadError.value = ''
  skipAudienceClear.value = true
  try {
    if (!id) {
      loadError.value = 'Missing list id'
      data.value = null
      return
    }
    const [res, detail] = await Promise.all([
      $fetch<RecipientListFormPayload>('/api/v1/tenant/recipient-list', {
        credentials: 'include',
        ...serverAuthHeaders()
      }),
      $fetch<ListDetailForEdit>(`/api/v1/tenant/recipient-list/${encodeURIComponent(id)}`, {
        credentials: 'include',
        ...serverAuthHeaders(),
        query: { page: 1, limit: 1 }
      })
    ])
    data.value = {
      tenantIdConfigured: res.tenantIdConfigured,
      contactCounts: res.contactCounts ?? {
        prospect: 0,
        client: 0,
        contact: 0
      },
      recipientFilters: res.recipientFilters ?? []
    }
    hydrateFromList(detail.list)
    await nextTick()
    skipAudienceClear.value = false
  } catch (e: unknown) {
    loadError.value =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message ?? 'Failed to load')
        : 'Failed to load'
    data.value = null
  } finally {
    loadPending.value = false
  }
}

async function submitUpdate() {
  const id = listId.value
  if (!id) return
  saveError.value = ''
  saving.value = true
  try {
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      audience: form.audience,
      filterRows: form.filterRows
        .filter((r) => r.recipientFilterId.trim())
        .map((r) => ({
          recipientFilterId: r.recipientFilterId.trim(),
          listPropertyValue: r.listPropertyValue.trim()
        })),
      filterMode: showCombineCriteria.value ? form.filterMode : 'and'
    }

    await $fetch(`/api/v1/tenant/recipient-list/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      credentials: 'include',
      ...serverAuthHeaders(),
      body
    })
    await navigateTo(`/tenant/recipient-list/${encodeURIComponent(id)}`)
  } catch (e: unknown) {
    const msg =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message ?? 'Save failed')
        : 'Save failed'
    saveError.value = msg
  } finally {
    saving.value = false
  }
}

watch(
  listId,
  () => {
    loadAll()
  },
  { immediate: true }
)
</script>
