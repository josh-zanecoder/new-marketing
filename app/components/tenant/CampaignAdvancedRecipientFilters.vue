<script setup lang="ts">
/**
 * Advanced Recipient Filtering (campaign create/schedule).
 * Mounted only when the tenant has `allowTenantAdvancedRecipientFiltering` and the
 * campaign recipient mode is "filters". Reuses the recipient-list filter machinery
 * (same registry fields, groups, And/Or joins as the CRM list builder).
 */
import { useRecipientListForm } from '~/composables/useRecipientListForm'
import { useTenantMarketingApi } from '~/composables/useTenantMarketingApi'
import { borrowerStatusLabel } from '~~/shared/utils/borrowerStatusLabel'
import {
  recipientAvatarTone,
  recipientInitials,
  recipientStatusTone
} from '~/utils/recipientDisplay'
import { isBuiltinFilterId } from '~~/shared/campaignBuiltinFilters'
import { categoryTokensFromStatuses } from '~~/shared/marketingStatusCategories'
import type { AdvancedRecipientFiltersInitial } from '~~/shared/campaignAdvancedRecipientFilters'

export interface CampaignAdvancedRecipientFiltersPayload {
  /** Body for POST /campaigns `advancedRecipientFilters`. Null until the filter is valid. */
  body: Record<string, unknown> | null
  /** Filter form is valid (audience + complete conditions). */
  ready: boolean
  /** Marketable contacts matching the filter (server count). */
  total: number
}

interface PreviewContact {
  id: string
  email: string
  name: string
  status: string
  city: string
  state: string
}

const props = defineProps<{
  /** Saved values to reopen (editing a filter-built campaign). Applied once, after the form loads. */
  initial?: AdvancedRecipientFiltersInitial | null
}>()

const emit = defineEmits<{
  update: [payload: CampaignAdvancedRecipientFiltersPayload]
}>()

const rl = useRecipientListForm({ mode: 'create' })
const marketingApi = useTenantMarketingApi()

const initials = recipientInitials
const avatarTone = recipientAvatarTone
const statusTone = recipientStatusTone

const {
  form,
  data,
  loadPending,
  loadError,
  audienceFieldSelectOptions,
  audienceOptions,
  canAddFilter,
  submitBlockReasons,
  recipientFilterSelectOptions,
  registryValueSelectOptions,
  onRowFilterChange,
  addFilterRow,
  removeFilterGroup,
  removeFilterRow,
  showPropertyRowFor,
  rowRegistryTokens,
  rowRegistryValueDisplay,
  propertyValuePlaceholderFor,
  showCombineBeforeFormRow,
  joinSlotBeforeFormRow,
  buildSaveBody,
  hydrateFromSaved
} = rl

/** The list name is not asked here; the campaign name labels the auto-created list. */
const CAMPAIGN_IGNORED_REASON = 'Enter a list name.'

const reasons = computed(() =>
  submitBlockReasons.value.filter((r) => r !== CAMPAIGN_IGNORED_REASON)
)
const ready = computed(() => reasons.value.length === 0)

const total = ref(0)
const PREVIEW_PAGE_SIZE = 25

const sample = ref<PreviewContact[]>([])
const page = ref(1)
const previewOpen = ref(false)
const previewPending = ref(false)
const previewError = ref('')
let previewSeq = 0
let previewTimer: ReturnType<typeof setTimeout> | null = null

/** Who the campaign is sent on behalf of; empty = every contact the sender can see. */
const selectedLoanOfficers = ref<{ email: string; name: string }[]>([])
/** Marketing status categories (`category:<key>`) to limit to; empty = any status. */
const selectedStatuses = ref<string[]>([])

const statusChoices = ref<{ value: string; label: string; count: number }[]>([])
const loanOfficerChoices = ref<{ email: string; name: string }[]>([])
const loanOfficerSearch = ref('')
let loanOfficerSearchTimer: ReturnType<typeof setTimeout> | null = null

const availableLoanOfficers = computed(() => {
  const picked = new Set(selectedLoanOfficers.value.map((lo) => lo.email))
  return loanOfficerChoices.value.filter((lo) => !picked.has(lo.email))
})

/** Names seen so far, so chips restored from an email can show the person's name. */
const knownLoanOfficerNames = new Map<string, string>()

function rememberLoanOfficers(list: { email: string; name: string }[]) {
  for (const lo of list) knownLoanOfficerNames.set(lo.email, lo.name)
  selectedLoanOfficers.value = selectedLoanOfficers.value.map((lo) => ({
    email: lo.email,
    name: knownLoanOfficerNames.get(lo.email) ?? lo.name
  }))
}

async function loadAudienceOptions() {
  try {
    const res = await marketingApi.fetchAdvancedAudienceOptions()
    statusChoices.value = res.statuses
    loanOfficerChoices.value = res.loanOfficers
    rememberLoanOfficers(res.loanOfficers)
  } catch {
    // Pickers are optional — the field filters below still work without them.
  }
}

/**
 * Standard contact fields (state, city, ZIP, …) are offered next to any admin-registered filters.
 * One request per contact type; reopening a saved audience waits on it so saved rows resolve.
 */
const builtinLoads = new Map<string, Promise<void>>()
function loadBuiltinFilters(audience: string): Promise<void> {
  const aud = audience.trim().toLowerCase()
  if (!aud || !data.value) return Promise.resolve()
  const existing = builtinLoads.get(aud)
  if (existing) return existing
  const load = (async () => {
    try {
      const res = await marketingApi.fetchAdvancedBuiltinFilters(aud)
      if (!data.value) return
      const registry = data.value.recipientFilters.filter((f) => !isBuiltinFilterId(f.id))
      // A field the tenant already registered for this contact type is not offered twice.
      const taken = new Set(
        registry
          .filter((f) => (f.contactType ?? '').trim().toLowerCase() === aud)
          .map((f) => `${f.property}:${f.propertyType}`)
      )
      data.value = {
        ...data.value,
        recipientFilters: [
          ...registry,
          ...res.filters.filter((f) => !taken.has(`${f.property}:${f.propertyType}`))
        ]
      }
    } catch {
      builtinLoads.delete(aud) // registry filters still work; retry on the next change
    }
  })()
  builtinLoads.set(aud, load)
  return load
}

watch(
  [data, () => form.audience],
  ([loaded, audience]) => {
    if (loaded && audience) void loadBuiltinFilters(audience)
  },
  { immediate: true }
)

/** Reopen a saved audience (edit page). Waits for the registry filters so values resolve. */
const initialApplied = ref(false)
async function applyInitial() {
  const init = props.initial
  if (!init || initialApplied.value || !data.value) return
  initialApplied.value = true
  await loadBuiltinFilters(init.audience)
  await hydrateFromSaved({
    audience: init.audience,
    filterMode: init.filterMode,
    criterionJoins: init.criterionJoins,
    filterRows: init.filterRows,
    filterGroups: init.filterGroups,
    groupJoins: init.groupJoins
  })
  selectedStatuses.value = categoryTokensFromStatuses(init.audienceStatuses)
  selectedLoanOfficers.value = init.loanOfficerEmails.map((email) => ({
    email,
    name: knownLoanOfficerNames.get(email) ?? email
  }))
}

watch([() => props.initial, data], () => void applyInitial(), { immediate: true })

function addLoanOfficer(lo: { email: string; name: string }) {
  if (selectedLoanOfficers.value.some((x) => x.email === lo.email)) return
  selectedLoanOfficers.value = [...selectedLoanOfficers.value, lo]
}

function removeLoanOfficer(email: string) {
  selectedLoanOfficers.value = selectedLoanOfficers.value.filter((x) => x.email !== email)
}

function toggleStatus(value: string) {
  selectedStatuses.value = selectedStatuses.value.includes(value)
    ? selectedStatuses.value.filter((s) => s !== value)
    : [...selectedStatuses.value, value]
}

watch(loanOfficerSearch, (q) => {
  if (loanOfficerSearchTimer) clearTimeout(loanOfficerSearchTimer)
  loanOfficerSearchTimer = setTimeout(async () => {
    try {
      const res = await marketingApi.fetchAdvancedAudienceOptions(q)
      if (q === loanOfficerSearch.value) loanOfficerChoices.value = res.loanOfficers
      rememberLoanOfficers(res.loanOfficers)
    } catch {
      /* keep the previous choices */
    }
  }, 250)
})

onMounted(() => {
  void loadAudienceOptions()
})

const bodyKey = computed(() =>
  JSON.stringify({
    ...buildSaveBody(),
    loanOfficerEmails: selectedLoanOfficers.value.map((lo) => lo.email),
    audienceStatuses: selectedStatuses.value
  })
)

const pageCount = computed(() => Math.max(1, Math.ceil(total.value / PREVIEW_PAGE_SIZE)))
const rangeFrom = computed(() => (total.value === 0 ? 0 : (page.value - 1) * PREVIEW_PAGE_SIZE + 1))
const rangeTo = computed(() => Math.min(total.value, page.value * PREVIEW_PAGE_SIZE))

/** One page of the full recipient list for the Preview pop-up, always for the current filters. */
function loadPreviewPage(args: { page: number, limit: number, search: string }) {
  return marketingApi.previewRecipientFilters({
    ...(JSON.parse(bodyKey.value) as Record<string, unknown>),
    page: args.page,
    limit: args.limit,
    search: args.search
  })
}

async function runPreview(body: Record<string, unknown>) {
  const seq = ++previewSeq
  previewPending.value = true
  previewError.value = ''
  try {
    const res = await marketingApi.previewRecipientFilters({
      ...body,
      page: page.value,
      limit: PREVIEW_PAGE_SIZE
    })
    if (seq !== previewSeq) return
    total.value = res.total
    sample.value = res.contacts
  } catch (e: unknown) {
    if (seq !== previewSeq) return
    previewError.value =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message ?? 'Could not count contacts')
        : 'Could not count contacts'
    total.value = 0
    sample.value = []
  } finally {
    if (seq === previewSeq) previewPending.value = false
  }
}

/** Move through the matching contacts; the filter itself is unchanged. */
function goToPage(next: number) {
  const clamped = Math.min(pageCount.value, Math.max(1, next))
  if (clamped === page.value || !ready.value) return
  page.value = clamped
  void runPreview(JSON.parse(bodyKey.value) as Record<string, unknown>)
}

watch(
  [ready, bodyKey],
  ([isReady]) => {
    if (previewTimer) clearTimeout(previewTimer)
    page.value = 1
    if (!isReady) {
      previewSeq += 1
      total.value = 0
      sample.value = []
      previewOpen.value = false
      previewPending.value = false
      return
    }
    previewTimer = setTimeout(() => {
      void runPreview(JSON.parse(bodyKey.value) as Record<string, unknown>)
    }, 350)
  },
  { immediate: true }
)

watch(
  [ready, bodyKey, total],
  () => {
    emit('update', {
      body: ready.value ? (JSON.parse(bodyKey.value) as Record<string, unknown>) : null,
      ready: ready.value,
      total: total.value
    })
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (previewTimer) clearTimeout(previewTimer)
  if (loanOfficerSearchTimer) clearTimeout(loanOfficerSearchTimer)
})
</script>

<template>
  <div class="space-y-5">
    <div
      v-if="loadError"
      class="rounded-xl border border-red-200/90 bg-red-50 px-4 py-3 text-sm text-red-800"
      role="alert"
    >
      {{ loadError }}
    </div>

    <div
      v-if="loadPending"
      class="h-24 animate-pulse rounded-xl bg-slate-100"
      aria-hidden="true"
    />

    <template v-else-if="data">
      <div class="grid gap-x-6 gap-y-5 md:grid-cols-[minmax(220px,1fr)_minmax(0,2fr)]">
        <div class="space-y-5 self-start rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4">
      <div>
        <label
          for="campaign-filter-contact-type"
          class="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
        >
          <TenantCampaignFilterIcon name="users" class="h-4 w-4 text-slate-400" />
          Contact type
        </label>
        <TenantFilterSelect
          id="campaign-filter-contact-type"
          v-model="form.audience"
          label="Contact type"
          variant="field"
          :options="audienceFieldSelectOptions"
          :disabled="!audienceOptions.length"
        />
        <p
          v-if="!audienceOptions.length"
          class="mt-2 text-sm text-slate-500"
        >
          Add at least one enabled contact type under tenant contact types (Admin).
        </p>
      </div>

      <div v-if="loanOfficerChoices.length || loanOfficerSearch || selectedLoanOfficers.length">
        <label
          for="campaign-filter-loan-officer"
          class="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
        >
          <TenantCampaignFilterIcon name="officer" class="h-4 w-4 text-slate-400" />
          Assigned loan officers
        </label>
        <div
          v-if="selectedLoanOfficers.length"
          class="mb-2 flex flex-wrap gap-1.5"
        >
          <span
            v-for="lo in selectedLoanOfficers"
            :key="lo.email"
            class="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-white py-1 pl-1 pr-1.5 text-xs font-semibold text-sky-900 shadow-sm"
          >
            <span
              class="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold"
              :class="avatarTone(lo.email)"
            >{{ initials(lo.name) }}</span>
            {{ lo.name }}
            <button
              type="button"
              class="flex h-5 w-5 items-center justify-center rounded-full text-sky-700 hover:bg-sky-100"
              :aria-label="`Remove ${lo.name}`"
              @click="removeLoanOfficer(lo.email)"
            >
              ×
            </button>
          </span>
        </div>
        <div class="relative">
          <TenantCampaignFilterIcon
            name="search"
            class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          />
          <input
            id="campaign-filter-loan-officer"
            v-model="loanOfficerSearch"
            type="search"
            autocomplete="off"
            placeholder="Search loan officers"
            class="w-full rounded-xl border border-slate-200/90 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 focus:border-primary-300 focus:outline-none focus:ring-[3px] focus:ring-primary-500/20"
          >
        </div>
        <ul
          v-if="availableLoanOfficers.length"
          class="mt-2 max-h-44 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200/80 bg-white"
        >
          <li
            v-for="lo in availableLoanOfficers"
            :key="lo.email"
          >
            <button
              type="button"
              class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-slate-50"
              @click="addLoanOfficer(lo)"
            >
              <span
                class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                :class="avatarTone(lo.email)"
              >{{ initials(lo.name) }}</span>
              <span class="min-w-0 flex-1">
                <span class="block truncate font-medium text-slate-900">{{ lo.name }}</span>
                <span class="block truncate text-xs text-slate-500">{{ lo.email }}</span>
              </span>
            </button>
          </li>
        </ul>
        <p
          v-else-if="loanOfficerSearch"
          class="mt-2 text-sm text-slate-500"
        >
          No loan officers match “{{ loanOfficerSearch }}”.
        </p>
      </div>

      <div
        v-if="form.filterGroups.length"
        class="border-t border-slate-100 pt-5"
      >
        <p class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <TenantCampaignFilterIcon name="filter" class="h-4 w-4 text-slate-400" />
          More filters
        </p>
      </div>

      <template v-for="(group, gIdx) in form.filterGroups" :key="gIdx">
        <div
          v-if="gIdx > 0"
          class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
        >
          <div class="h-px flex-1 bg-slate-200" aria-hidden="true" />
          <div class="flex rounded-full border border-slate-200 bg-white p-0.5">
            <button
              type="button"
              class="rounded-full px-3 py-1"
              :class="form.groupJoins[gIdx - 1] === 'and' ? 'bg-slate-900 text-white' : 'text-slate-600'"
              @click="form.groupJoins[gIdx - 1] = 'and'"
            >
              And
            </button>
            <button
              type="button"
              class="rounded-full px-3 py-1"
              :class="form.groupJoins[gIdx - 1] === 'or' ? 'bg-amber-500 text-white' : 'text-slate-600'"
              @click="form.groupJoins[gIdx - 1] = 'or'"
            >
              Or
            </button>
          </div>
          <div class="h-px flex-1 bg-slate-200" aria-hidden="true" />
        </div>

        <div class="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 sm:p-4">
          <div class="mb-3 flex items-center justify-between gap-3">
            <p class="text-sm font-semibold text-slate-900">Group {{ gIdx + 1 }}</p>
            <button
              type="button"
              class="text-xs font-semibold text-red-700 hover:underline"
              @click="removeFilterGroup(gIdx)"
            >
              Remove group
            </button>
          </div>

          <div
            v-for="(row, idx) in group.rows"
            :key="idx"
            class="mb-3 last:mb-0"
          >
            <div
              v-if="showCombineBeforeFormRow(group, idx)"
              class="mb-3 flex justify-center"
            >
              <div class="flex rounded-full border border-slate-200 bg-white p-0.5">
                <button
                  type="button"
                  class="rounded-full px-3 py-1 text-xs font-semibold"
                  :class="group.joins[joinSlotBeforeFormRow(group, idx)] === 'and' ? 'bg-slate-900 text-white' : 'text-slate-500'"
                  @click="group.joins[joinSlotBeforeFormRow(group, idx)] = 'and'"
                >
                  And
                </button>
                <button
                  type="button"
                  class="rounded-full px-3 py-1 text-xs font-semibold"
                  :class="group.joins[joinSlotBeforeFormRow(group, idx)] === 'or' ? 'bg-amber-500 text-white' : 'text-slate-500'"
                  @click="group.joins[joinSlotBeforeFormRow(group, idx)] = 'or'"
                >
                  Or
                </button>
              </div>
            </div>

            <div class="grid grid-cols-1 gap-3 rounded-xl border border-white bg-white p-3 shadow-sm">
              <div>
                <label
                  :for="`campaign-filter-${gIdx}-${idx}`"
                  class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-sky-800"
                >
                  Field
                </label>
                <TenantFilterSelect
                  :id="`campaign-filter-${gIdx}-${idx}`"
                  v-model="row.recipientFilterId"
                  label="Field"
                  variant="field"
                  :options="recipientFilterSelectOptions(idx)"
                  @change="onRowFilterChange(row)"
                />
              </div>
              <div
                v-if="row.recipientFilterId"
              >
                <label
                  :for="`campaign-filter-value-${gIdx}-${idx}`"
                  class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-emerald-800"
                >
                  Value
                </label>
                <template v-if="showPropertyRowFor(row) && rowRegistryTokens(row).length > 1">
                  <TenantFilterSelect
                    :id="`campaign-filter-value-${gIdx}-${idx}`"
                    v-model="row.listPropertyValue"
                    label="Value"
                    variant="field"
                    :options="registryValueSelectOptions(row)"
                  />
                </template>
                <p
                  v-else-if="showPropertyRowFor(row) && rowRegistryTokens(row).length === 1"
                  class="break-words rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-slate-900"
                >
                  {{ rowRegistryValueDisplay(row) }}
                </p>
                <input
                  v-else-if="showPropertyRowFor(row)"
                  :id="`campaign-filter-value-${gIdx}-${idx}`"
                  v-model="row.listPropertyValue"
                  type="text"
                  maxlength="2000"
                  class="w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-primary-300 focus:outline-none focus:ring-[3px] focus:ring-primary-500/20"
                  :placeholder="propertyValuePlaceholderFor(row)"
                >
              </div>
              <div class="flex justify-end">
                <button
                  type="button"
                  class="text-xs font-semibold text-red-700 hover:underline"
                  @click="removeFilterRow(gIdx, idx)"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>

          <button
            v-if="canAddFilter"
            type="button"
            class="mt-3 w-full rounded-xl border border-dashed border-slate-300 bg-white/70 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-primary-300 hover:text-primary-800"
            @click="addFilterRow(gIdx)"
          >
            Add a condition to this group
          </button>
        </div>
      </template>


        </div>
        <div class="space-y-5">
      <div v-if="statusChoices.length">
        <p class="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <TenantCampaignFilterIcon name="status" class="h-4 w-4 text-slate-400" />
          Borrower status
        </p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="s in statusChoices"
            :key="s.value"
            type="button"
            class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition"
            :class="
              selectedStatuses.includes(s.value)
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : s.count === 0
                  ? 'border-slate-200 bg-white text-slate-400 hover:border-emerald-300'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300'
            "
            :aria-pressed="selectedStatuses.includes(s.value)"
            @click="toggleStatus(s.value)"
          >
            <span
              class="h-2 w-2 rounded-full"
              :class="selectedStatuses.includes(s.value) ? 'bg-white' : statusTone(s.value).dot"
            />
            {{ s.label }}
            <span
              class="ml-1 tabular-nums"
              :class="selectedStatuses.includes(s.value) ? 'text-emerald-100' : 'text-slate-400'"
            >{{ s.count.toLocaleString() }}</span>
          </button>
        </div>
      </div>


      <div
        class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        aria-live="polite"
      >
        <div class="flex items-center gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
          <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
            <TenantCampaignFilterIcon
              name="users"
              class="h-5 w-5"
            />
          </span>
          <p
            v-if="!ready"
            class="text-sm text-slate-600"
          >
            <span v-if="reasons.length">{{ reasons[0] }}</span>
            <span v-else>Complete the filter to see who matches.</span>
          </p>
          <p
            v-else-if="previewPending"
            class="text-sm text-slate-500"
          >
            Counting contacts…
          </p>
          <p
            v-else-if="previewError"
            class="text-sm text-red-700"
          >
            {{ previewError }}
          </p>
          <p
            v-else
            class="text-2xl font-semibold leading-none tabular-nums text-slate-900"
          >
            {{ total.toLocaleString() }}
            <span class="text-sm font-medium text-slate-500">
              recipient{{ total === 1 ? '' : 's' }}
            </span>
          </p>
          <button
            type="button"
            class="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-primary-300 hover:bg-primary-50/70 hover:text-primary-800 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!ready || previewPending || !!previewError || total === 0"
            @click="previewOpen = true"
          >
            <TenantCampaignFilterIcon
              name="users"
              class="h-4 w-4"
            />
            Preview
          </button>
        </div>
        <template v-if="ready && !previewPending && !previewError">
          <ul
            v-if="sample.length"
            class="divide-y divide-slate-100"
          >
            <li
              v-for="c in sample"
              :key="c.id"
              class="flex items-center gap-3 px-4 py-2.5 text-sm"
            >
              <span
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                :class="avatarTone(c.email || c.name)"
              >{{ initials(c.name) }}</span>
              <span class="min-w-0 flex-1">
                <span class="block truncate font-medium text-slate-900">{{ c.name }}</span>
                <span class="block truncate text-xs text-slate-500">{{ c.email }}</span>
              </span>
              <span
                v-if="c.status"
                class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                :class="statusTone(c.status).badge"
              >
                <span
                  class="h-1.5 w-1.5 rounded-full"
                  :class="statusTone(c.status).dot"
                />
                {{ borrowerStatusLabel(c.status) }}
              </span>
            </li>
          </ul>
          <div
            v-if="total > PREVIEW_PAGE_SIZE"
            class="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-4 py-2.5"
          >
            <p class="text-xs tabular-nums text-slate-500">
              {{ rangeFrom.toLocaleString() }}–{{ rangeTo.toLocaleString() }} of {{ total.toLocaleString() }}
            </p>
            <div class="flex items-center gap-1.5">
              <button
                type="button"
                class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="page <= 1 || previewPending"
                @click="goToPage(page - 1)"
              >
                Previous
              </button>
              <button
                type="button"
                class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="page >= pageCount || previewPending"
                @click="goToPage(page + 1)"
              >
                Next
              </button>
            </div>
          </div>
        </template>
      </div>
        </div>
      </div>
    </template>

    <TenantCampaignRecipientPreviewModal
      :open="previewOpen"
      title="Recipients matching your filters"
      :load="loadPreviewPage"
      :refresh-key="bodyKey"
      @close="previewOpen = false"
    />
  </div>
</template>
