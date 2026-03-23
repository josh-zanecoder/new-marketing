<template>
  <div class="min-h-screen bg-gradient-to-b from-slate-50 to-white">
    <div class="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl lg:px-8">
      <NuxtLink
        to="/tenant/recipient-list"
        class="mb-10 inline-flex items-center gap-2.5 text-base font-medium text-slate-600 transition-colors hover:text-slate-900"
      >
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        Back to lists
      </NuxtLink>

      <header class="mb-12">
        <h1 class="text-4xl font-bold text-slate-900 tracking-tight">
          New recipient list
        </h1>
        <p class="mt-2 text-lg text-slate-600">
          Pick an audience, then optionally add filters to narrow who’s included.
        </p>
      </header>

      <div
        v-if="data && !data.tenantIdConfigured"
        class="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-base text-amber-900"
      >
        Your tenant has no <strong>tenant ID</strong> in the registry. You can still save audience-only lists;
        admin-defined recipient filters appear once a tenant ID is set.
      </div>

      <div
        v-if="loadError"
        class="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-base text-red-700"
      >
        {{ loadError }}
      </div>

      <div v-if="loadPending" class="mb-12 space-y-6 animate-pulse">
        <div class="h-11 max-w-md rounded-xl bg-slate-200" />
        <div class="h-14 w-full rounded-xl bg-slate-200" />
        <div class="h-40 rounded-2xl bg-slate-200/80" />
      </div>

      <form
        v-else-if="data"
        class="space-y-6"
        @submit.prevent="submitCreate"
      >
        <div class="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60 overflow-hidden">
          <div class="space-y-6 p-8 sm:p-10">
            <div>
              <label for="rl-name" class="mb-2.5 block text-base font-semibold text-slate-700">List name</label>
              <input
                id="rl-name"
                v-model="form.name"
                type="text"
                required
                maxlength="200"
                placeholder="e.g. Texas prospects"
                class="w-full rounded-xl border border-slate-200 bg-white px-5 py-4 text-base text-slate-900 placeholder-slate-400 shadow-sm transition-colors focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/20"
              >
            </div>

            <div>
              <label for="rl-audience" class="mb-2.5 block text-base font-semibold text-slate-700">Audience</label>
              <select
                id="rl-audience"
                v-model="form.audience"
                class="w-full rounded-xl border border-slate-200 bg-white px-5 py-4 text-base text-slate-900 shadow-sm transition-colors focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
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
                class="mt-2 text-base text-slate-500"
              >
                Add at least one recipient filter in admin (per contact type) to choose an audience here.
              </p>
            </div>

            <div class="space-y-6">
              <p
                v-if="data.tenantIdConfigured && !filtersForAudience.length"
                class="text-base text-slate-500"
              >
                No enabled recipient filters for this audience. Ask an admin to add filters, or create the list with audience only.
              </p>

              <div
                v-for="(row, idx) in form.filterRows"
                :key="idx"
                class="space-y-3"
              >
                <div class="flex flex-wrap items-end justify-between gap-3">
                  <label
                    :for="`rl-filter-${idx}`"
                    class="mb-0 block text-base font-semibold text-slate-700"
                  >
                    {{ idx === 0 ? 'Filter' : 'Additional filter' }}
                  </label>
                  <button
                    type="button"
                    class="text-sm font-medium text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
                    @click="removeFilterRow(idx)"
                  >
                    Remove
                  </button>
                </div>

                <template v-if="!row.recipientFilterId">
                  <select
                    :id="`rl-filter-${idx}`"
                    v-model="row.recipientFilterId"
                    required
                    class="w-full rounded-xl border border-slate-200 bg-white px-5 py-4 text-base text-slate-900 shadow-sm transition-colors focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/20"
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
                  class="rounded-xl border border-slate-100 bg-slate-50/60 px-6 py-5"
                >
                  <p class="mb-4 text-base font-semibold text-slate-700">
                    Match rule
                  </p>
                  <div
                    class="grid grid-cols-1 items-center gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.25fr)] sm:gap-4"
                  >
                    <div class="min-w-0">
                      <select
                        :id="`rl-filter-${idx}`"
                        v-model="row.recipientFilterId"
                        class="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
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
                    <div class="text-center text-sm font-semibold uppercase tracking-wide text-slate-400 sm:px-1">
                      equals
                    </div>
                    <div class="min-w-0">
                      <template v-if="showPropertyRowFor(row) && rowRegistryTokens(row).length > 1">
                        <select
                          :id="`rl-list-property-value-${idx}`"
                          v-model="row.listPropertyValue"
                          required
                          class="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
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
                        class="break-words rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900"
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
                        class="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                        :placeholder="propertyValuePlaceholderFor(row)"
                      >
                    </div>
                  </div>
                </div>
              </div>

              <button
                v-if="filtersForAudience.length && canAddFilter"
                type="button"
                class="w-full rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-5 py-3.5 text-base font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
                @click="addFilterRow"
              >
                {{ form.filterRows.length ? 'Add another filter' : 'Add filter' }}
              </button>
            </div>

            <div v-if="showCombineCriteria">
              <label for="rl-filter-mode" class="mb-2.5 block text-base font-semibold text-slate-700">
                Combine criteria with
              </label>
              <select
                id="rl-filter-mode"
                v-model="form.filterMode"
                class="w-full rounded-xl border border-slate-200 bg-white px-5 py-4 text-base text-slate-900 shadow-sm transition-colors focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/20"
              >
                <option value="and">
                  AND — must match all conditions
                </option>
                <option value="or">
                  OR — match any one of the conditions
                </option>
              </select>
              <p class="mt-2 text-sm text-slate-500">
                <strong class="font-medium text-slate-600">AND</strong> = must match all conditions.
                <strong class="font-medium text-slate-600">OR</strong> = match any one of the conditions.
              </p>
            </div>
          </div>
        </div>

        <div v-if="saveError" class="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-base text-red-700">
          {{ saveError }}
        </div>

        <div class="flex flex-col-reverse items-stretch justify-end gap-4 pt-4 sm:flex-row sm:items-center">
          <NuxtLink
            to="/tenant/recipient-list"
            class="rounded-xl border border-slate-200 px-6 py-3.5 text-center text-base font-medium text-slate-700 transition-colors hover:bg-slate-50"
            :class="{ 'pointer-events-none opacity-50': saving }"
          >
            Cancel
          </NuxtLink>
          <button
            type="submit"
            class="rounded-xl bg-slate-900 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-slate-900/20 transition-all hover:bg-slate-800 hover:shadow-xl disabled:opacity-50"
            :disabled="saving || !canSubmitPropertyValue || !audienceOptions.length"
          >
            {{ saving ? 'Saving…' : 'Create list' }}
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

function serverAuthHeaders(): { headers?: HeadersInit } {
  if (!import.meta.server) return {}
  try {
    return { headers: useRequestHeaders(['cookie']) as HeadersInit }
  } catch {
    return {}
  }
}

const loadPending = ref(true)
const loadError = ref('')
const saveError = ref('')
const saving = ref(false)
const data = ref<RecipientListFormPayload | null>(null)

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

async function load() {
  loadPending.value = true
  loadError.value = ''
  try {
    const res = await $fetch<RecipientListFormPayload>('/api/v1/recipient-list', {
      credentials: 'include',
      ...serverAuthHeaders()
    })
    data.value = {
      tenantIdConfigured: res.tenantIdConfigured,
      contactCounts: res.contactCounts ?? {
        prospect: 0,
        client: 0,
        contact: 0
      },
      recipientFilters: res.recipientFilters ?? []
    }
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

async function submitCreate() {
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

    await $fetch('/api/v1/recipient-list', {
      method: 'POST',
      credentials: 'include',
      ...serverAuthHeaders(),
      body
    })
    await navigateTo('/tenant/recipient-list')
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

onMounted(() => {
  load()
})
</script>
