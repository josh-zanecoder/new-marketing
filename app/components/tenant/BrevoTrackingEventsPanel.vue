<script setup lang="ts">
import {
  isoMatchesBrevoTrackingRange,
  useBrevoTrackingDateRange
} from '~/composables/useBrevoTrackingDateRange'

interface BrevoEmailEvent {
  email?: string
  date?: string
  messageId?: string
  event?: string
  subject?: string
  tag?: string
  from?: string
  ip?: string
  link?: string
  reason?: string
  templateId?: number
}

interface BrevoEventReport {
  events?: BrevoEmailEvent[]
}

interface MessageEventGroup {
  messageId: string
  events: BrevoEmailEvent[]
}

interface TrackingTableRow {
  messageId: string
  campaignId: string | null
  subject: string
  latestIso: string
  recipientEmail: string
  tagSample: string
  eventTypesOrdered: string[]
  events: BrevoEmailEvent[]
}

const props = withDefaults(
  defineProps<{
    campaignId?: string
    panelHint?: string
    cardClass?: string
    /** Hide campaign column when viewing a single campaign's tracking tab. */
    hideCampaignColumn?: boolean
  }>(),
  {
    panelHint: '',
    cardClass:
      'overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm shadow-zinc-950/[0.04]',
    hideCampaignColumn: false
  }
)

const route = useRoute()

const query = computed(() => {
  const c = props.campaignId?.trim()
  return c ? { campaignId: c } : {}
})

const fetchKey = computed(() => `tenant-tracking-brevo-${props.campaignId?.trim() || 'all'}`)

const { data, error, pending } = useFetch<{ report: unknown }>('/api/v1/tracking', {
  query,
  key: fetchKey
})

const { data: campaignsListData } = useFetch<{ campaigns: Array<{ id: string; name: string }> }>(
  '/api/v1/tenant/campaigns',
  { key: 'tenant-brevo-tracking-campaign-names' }
)

const campaignNameById = computed(() => {
  const m = new Map<string, string>()
  for (const c of campaignsListData.value?.campaigns ?? []) {
    const id = c.id?.trim()
    if (id) m.set(id, (c.name ?? '').trim() || id)
  }
  return m
})

function campaignDisplayLabel(campaignId: string | null): string {
  if (!campaignId?.trim()) return ''
  const id = campaignId.trim()
  return campaignNameById.value.get(id) ?? id
}

const report = computed((): BrevoEventReport | null => {
  const r = data.value?.report
  if (r && typeof r === 'object' && r !== null && 'events' in r) {
    return r as BrevoEventReport
  }
  return null
})

const events = computed(() => report.value?.events ?? [])

function parseTagSegments(tagStr: string | undefined): string[] {
  if (!tagStr?.trim()) return []
  return tagStr.split(',').map((p) => p.trim()).filter(Boolean)
}

function parseCampaignIdFromTag(tag: string | undefined): string | null {
  for (const part of parseTagSegments(tag)) {
    if (part.toLowerCase().startsWith('campaign:')) {
      const id = part.slice('campaign:'.length).trim()
      return id || null
    }
  }
  return null
}

const MONGO_ID_RE = /^[a-f\d]{24}$/i

function isMongoId(s: string): boolean {
  return MONGO_ID_RE.test(s)
}

function campaignPagePath(campaignId: string): string {
  return `/tenant/campaigns/${campaignId.trim()}`
}

async function navigateToCampaign(campaignId: string | null) {
  const id = campaignId?.trim()
  if (!id || !isMongoId(id)) return

  const path = campaignPagePath(id)
  if (route.path === path) {
    await navigateTo({ path, query: { ...route.query, view: 'details' } })
    return
  }

  await navigateTo(path)
}

async function onCampaignLinkClick(event: MouseEvent, campaignId: string | null) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return
  }

  event.preventDefault()
  await navigateToCampaign(campaignId)
}

const messageGroups = computed((): MessageEventGroup[] => {
  const map = new Map<string, BrevoEmailEvent[]>()
  for (const ev of events.value) {
    const key = ev.messageId?.trim() || '(no message id)'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(ev)
  }
  const groups = [...map.entries()].map(([messageId, evs]) => {
    const sorted = [...evs].sort(
      (a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime()
    )
    return { messageId, events: sorted }
  })
  groups.sort(
    (a, b) =>
      new Date(b.events[0]?.date || 0).getTime() - new Date(a.events[0]?.date || 0).getTime()
  )
  return groups
})

function groupLatestIso(g: MessageEventGroup): string {
  let max = 0
  let iso = ''
  for (const e of g.events) {
    const t = new Date(e.date || 0).getTime()
    if (t >= max) {
      max = t
      iso = e.date || ''
    }
  }
  return iso
}

function groupSubject(g: MessageEventGroup): string {
  const sub = g.events.find((e) => e.subject?.trim())?.subject
  return (sub || g.events[0]?.subject || '').trim() || '—'
}

function groupRecipient(g: MessageEventGroup): string {
  const em = g.events.find((e) => e.email?.trim())?.email
  return (em || '').trim()
}

function groupTagSample(g: MessageEventGroup): string {
  return g.events.find((e) => e.tag?.trim())?.tag?.trim() || ''
}

function eventTypesInOrder(g: MessageEventGroup): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const e of g.events) {
    const ev = (e.event || '').trim()
    if (!ev || seen.has(ev)) continue
    seen.add(ev)
    out.push(ev)
  }
  return out
}

const searchQuery = ref('')
const selectedEventTypes = ref<string[]>([])

const {
  datePreset,
  customDateFrom,
  customDateTo,
  effectiveDateRange,
  dateRangeFilterActive,
  dateRangeLabel,
  resetDateRange
} = useBrevoTrackingDateRange()

function groupMatchesDateRange(g: MessageEventGroup): boolean {
  const range = effectiveDateRange.value
  if (!range.from && !range.to) return true
  return g.events.some((e) => isoMatchesBrevoTrackingRange(e.date, range))
}

function groupMatchesSearch(g: MessageEventGroup): boolean {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return true
  const campaign = parseCampaignIdFromTag(groupTagSample(g) || g.events[0]?.tag)
  const campaignName = campaign ? campaignNameById.value.get(campaign) ?? '' : ''
  const parts = [
    groupSubject(g),
    g.messageId,
    groupRecipient(g),
    groupTagSample(g),
    campaign ?? '',
    campaignName
  ]
    .join(' ')
    .toLowerCase()
  return parts.includes(q) || parts.split(/\s+/).some((w) => w.includes(q))
}

const groupsAfterSearchDate = computed(() =>
  messageGroups.value.filter((g) => groupMatchesDateRange(g) && groupMatchesSearch(g))
)

const availableEventTypes = computed(() => {
  const s = new Set<string>()
  for (const g of groupsAfterSearchDate.value) {
    for (const e of g.events) {
      const ev = (e.event || '').trim()
      if (ev) s.add(ev)
    }
  }
  return [...s].sort((a, b) => a.localeCompare(b))
})

const messageCountByEventType = computed(() => {
  const m = new Map<string, number>()
  for (const g of groupsAfterSearchDate.value) {
    const types = new Set(g.events.map((e) => (e.event || '').trim()).filter(Boolean))
    for (const t of types) {
      m.set(t, (m.get(t) ?? 0) + 1)
    }
  }
  return m
})

function countMessagesWithEventType(t: string): number {
  return messageCountByEventType.value.get(t) ?? 0
}

function toggleEventFilter(name: string) {
  const i = selectedEventTypes.value.indexOf(name)
  if (i === -1) selectedEventTypes.value = [...selectedEventTypes.value, name]
  else selectedEventTypes.value = selectedEventTypes.value.filter((_, j) => j !== i)
}

function clearEventFilters() {
  selectedEventTypes.value = []
}

const tableRows = computed((): TrackingTableRow[] => {
  const sel = selectedEventTypes.value
  let groups = groupsAfterSearchDate.value
  if (sel.length) {
    groups = groups.filter((g) => g.events.some((e) => sel.includes((e.event || '').trim())))
  }

  return groups.map((g) => {
    const tag = groupTagSample(g) || g.events[0]?.tag
    const campaignId = parseCampaignIdFromTag(tag)
    let types = eventTypesInOrder(g)
    if (sel.length) types = types.filter((t) => sel.includes(t))
    return {
      messageId: g.messageId,
      campaignId,
      subject: groupSubject(g),
      latestIso: groupLatestIso(g),
      recipientEmail: groupRecipient(g),
      tagSample: tag || '',
      eventTypesOrdered: types,
      events: g.events
    }
  })
})

function formatEventDate(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

function eventBadgeClass(ev: string | undefined): string {
  const e = (ev || '').toLowerCase()
  if (e === 'delivered') return 'bg-emerald-50 text-emerald-800 ring-emerald-200/80'
  if (e === 'requests' || e === 'sent') return 'bg-sky-50 text-sky-800 ring-sky-200/80'
  if (e.includes('bounce') || e === 'hard_bounces' || e === 'soft_bounces')
    return 'bg-red-50 text-red-800 ring-red-200/80'
  if (e.includes('open') || e === 'unique_opened') return 'bg-violet-50 text-violet-800 ring-violet-200/80'
  if (e.includes('click')) return 'bg-amber-50 text-amber-800 ring-amber-200/80'
  return 'bg-zinc-100 text-zinc-700 ring-zinc-200/80'
}

const {
  currentPage,
  totalPages,
  paginatedItems: paginatedTableRows,
  paginationMeta
} = useClientPagination(tableRows, 10)

watch([searchQuery, datePreset, customDateFrom, customDateTo, selectedEventTypes], () => {
  currentPage.value = 1
})

function clearAllFilters() {
  searchQuery.value = ''
  resetDateRange()
  clearEventFilters()
}

const hasActiveFilters = computed(
  () =>
    !!searchQuery.value.trim() ||
    dateRangeFilterActive.value ||
    selectedEventTypes.value.length > 0
)

</script>

<template>
  <div>
    <div
      v-if="pending"
      class="flex flex-col items-center justify-center rounded-2xl border border-zinc-200/90 bg-white px-6 py-16 shadow-sm shadow-zinc-950/[0.04] sm:py-20"
    >
      <div
        class="h-10 w-10 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-800"
        aria-hidden="true"
      />
      <p class="mt-4 text-sm font-medium text-zinc-600">
        Loading event report…
      </p>
    </div>

    <div
      v-else-if="error"
      class="flex gap-3 rounded-2xl border border-red-200/80 bg-red-50/90 px-4 py-3.5 text-sm text-red-900 shadow-sm"
      role="alert"
    >
      <svg class="mt-0.5 h-5 w-5 shrink-0 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
      <span class="min-w-0 leading-relaxed">{{ error.message || 'Failed to load event report' }}</span>
    </div>

    <div v-else-if="events.length > 0" class="space-y-0">
      <!-- Filters sit on page background (same pattern as campaigns list: controls above the card) -->
      <div class="mb-4 space-y-3 sm:mb-6 sm:space-y-4">
        <p v-if="panelHint?.trim()" class="text-sm text-zinc-500">
          {{ panelHint }}
        </p>
        <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
          <div class="relative min-w-0 w-full sm:w-80 md:w-96">
            <label class="sr-only" for="brevo-tracking-search">Search events</label>
            <svg class="pointer-events-none absolute left-3.5 top-1/2 h-[1.125rem] w-[1.125rem] -translate-y-1/2 text-zinc-400 sm:left-4 sm:h-[18px] sm:w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              id="brevo-tracking-search"
              v-model="searchQuery"
              type="search"
              autocomplete="off"
              placeholder="Subject, email, campaign…"
              class="w-full rounded-2xl border border-zinc-200/90 bg-white py-3 pl-11 pr-4 text-sm text-zinc-900 shadow-sm shadow-zinc-950/5 placeholder:text-zinc-400 transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 sm:pl-12"
            >
          </div>
          <TenantBrevoTrackingDateRangePicker
            v-model:preset="datePreset"
            v-model:custom-from="customDateFrom"
            v-model:custom-to="customDateTo"
            :label="dateRangeLabel"
          />
          <button
            v-if="hasActiveFilters"
            type="button"
            class="inline-flex w-full items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 sm:w-auto"
            @click="clearAllFilters"
          >
            Clear filters
          </button>
        </div>
        <div v-if="availableEventTypes.length">
          <p class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Event type
          </p>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="rounded-full px-3.5 py-1.5 text-xs font-medium capitalize ring-1 transition"
              :class="
                selectedEventTypes.length === 0
                  ? 'bg-zinc-900 text-white ring-zinc-900 shadow-sm'
                  : 'bg-white text-zinc-700 ring-zinc-200/90 shadow-sm shadow-zinc-950/5 hover:bg-zinc-50'
              "
              @click="clearEventFilters"
            >
              All
              <span class="ml-1 tabular-nums opacity-90">({{ groupsAfterSearchDate.length }})</span>
            </button>
            <button
              v-for="t in availableEventTypes"
              :key="t"
              type="button"
              class="rounded-full px-3.5 py-1.5 text-xs font-medium capitalize ring-1 transition"
              :class="
                selectedEventTypes.includes(t)
                  ? 'bg-zinc-900 text-white ring-zinc-900 shadow-sm'
                  : 'bg-white text-zinc-700 ring-zinc-200/90 shadow-sm shadow-zinc-950/5 hover:bg-zinc-50'
              "
              @click="toggleEventFilter(t)"
            >
              {{ t }}
              <span class="ml-1 tabular-nums opacity-90">({{ countMessagesWithEventType(t) }})</span>
            </button>
          </div>
        </div>
      </div>

      <div class="space-y-2 sm:space-y-4">
        <TenantBrevoTrackingLineChart
          :events="events"
          :date-range="effectiveDateRange"
          :selected-event-types="selectedEventTypes"
        />

        <div :class="cardClass">
          <div
            v-if="tableRows.length === 0"
            class="px-4 py-14 text-center sm:px-6 sm:py-16"
          >
            <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400">
              <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </div>
            <p class="mt-4 text-sm font-medium text-zinc-900">
              No messages match your filters
            </p>
            <p class="mt-1 text-sm text-zinc-500">
              Try clearing search, widening the date range, or resetting event types.
            </p>
            <button
              v-if="hasActiveFilters"
              type="button"
              class="mt-6 inline-flex items-center rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50"
              @click="clearAllFilters"
            >
              Clear all filters
            </button>
          </div>

          <template v-else>
            <ul class="divide-y divide-zinc-100 lg:hidden">
              <li
                v-for="(row, idx) in paginatedTableRows"
                :key="`mobile-${row.messageId}-${idx}`"
                class="p-4"
              >
                <div class="space-y-2">
                  <div :class="{ hidden: hideCampaignColumn }">
                    <p class="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Campaign</p>
                    <NuxtLink
                      v-if="row.campaignId && isMongoId(row.campaignId)"
                      :to="campaignPagePath(row.campaignId)"
                      class="mt-0.5 block truncate font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2"
                      @click="onCampaignLinkClick($event, row.campaignId)"
                    >
                      {{ campaignDisplayLabel(row.campaignId) }}
                    </NuxtLink>
                    <p v-else-if="row.campaignId" class="mt-0.5 truncate font-mono text-xs text-zinc-700">
                      {{ row.campaignId }}
                    </p>
                    <p v-else class="mt-0.5 text-sm text-zinc-400">—</p>
                  </div>
                  <div>
                    <p class="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Recipient</p>
                    <p
                      class="mt-0.5 break-all text-sm text-zinc-800"
                      :class="{ 'text-zinc-400': !row.recipientEmail?.trim() }"
                    >
                      {{ row.recipientEmail?.trim() || '—' }}
                    </p>
                  </div>
                  <div>
                    <p class="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Subject</p>
                    <p class="mt-0.5 line-clamp-2 text-sm text-zinc-900">
                      {{ row.subject }}
                    </p>
                  </div>
                  <p class="text-xs tabular-nums text-zinc-500">
                    {{ formatEventDate(row.latestIso) }}
                  </p>
                  <div class="flex flex-wrap gap-1.5 pt-1">
                    <span
                      v-for="ev in row.eventTypesOrdered"
                      :key="ev"
                      class="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize ring-1 ring-inset sm:text-xs"
                      :class="eventBadgeClass(ev)"
                    >
                      {{ ev }}
                    </span>
                  </div>
                </div>
              </li>
            </ul>

            <div class="hidden overflow-x-auto lg:block">
              <table class="w-full text-left text-sm">
                <thead>
                  <tr class="border-b border-zinc-200 bg-zinc-50/90">
                    <th
                      scope="col"
                      class="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500 sm:px-6"
                      :class="{ hidden: hideCampaignColumn }"
                    >
                      Campaign
                    </th>
                    <th scope="col" class="min-w-[9rem] px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500 sm:px-6">
                      Recipient
                    </th>
                    <th scope="col" class="min-w-[10rem] px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500 sm:px-6">
                      Subject
                    </th>
                    <th scope="col" class="whitespace-nowrap px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500 sm:px-6">
                      Date
                    </th>
                    <th scope="col" class="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500 sm:px-6">
                      Events
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-zinc-100">
                  <tr
                    v-for="(row, idx) in paginatedTableRows"
                    :key="`${row.messageId}-${idx}`"
                    class="transition-colors hover:bg-zinc-50/80"
                  >
                    <td class="px-5 py-4 align-top sm:px-6" :class="{ hidden: hideCampaignColumn }">
                      <NuxtLink
                        v-if="row.campaignId && isMongoId(row.campaignId)"
                        :to="campaignPagePath(row.campaignId)"
                        class="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 transition hover:text-zinc-600 hover:decoration-zinc-400"
                        :title="row.campaignId"
                        @click="onCampaignLinkClick($event, row.campaignId)"
                      >
                        {{ campaignDisplayLabel(row.campaignId) }}
                      </NuxtLink>
                      <span v-else-if="row.campaignId" class="font-mono text-xs text-zinc-700">{{
                        row.campaignId
                      }}</span>
                      <span v-else class="text-zinc-400">—</span>
                    </td>
                    <td
                      class="max-w-[14rem] break-all px-5 py-4 align-top text-sm text-zinc-800 sm:px-6"
                      :class="{ 'text-zinc-400': !row.recipientEmail?.trim() }"
                    >
                      {{ row.recipientEmail?.trim() || '—' }}
                    </td>
                    <td class="max-w-xs px-5 py-4 align-top text-zinc-900 sm:px-6" :title="row.subject">
                      <span class="line-clamp-2 leading-snug">{{ row.subject }}</span>
                    </td>
                    <td class="whitespace-nowrap px-5 py-4 align-top tabular-nums text-zinc-600 sm:px-6">
                      {{ formatEventDate(row.latestIso) }}
                    </td>
                    <td class="px-5 py-4 align-top sm:px-6">
                      <div class="flex flex-wrap gap-1.5">
                        <span
                          v-for="ev in row.eventTypesOrdered"
                          :key="ev"
                          class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset"
                          :class="eventBadgeClass(ev)"
                        >
                          {{ ev }}
                        </span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div
              v-if="totalPages > 1"
              class="flex items-center justify-between gap-3 border-t border-zinc-100 bg-zinc-50/60 px-4 py-3.5 sm:gap-4 sm:px-6 sm:py-4"
            >
              <p class="min-w-0 text-xs tabular-nums text-zinc-500 sm:text-sm">
                <span class="font-semibold text-zinc-800">{{ paginationMeta.from }}–{{ paginationMeta.to }}</span>
                <span class="text-zinc-300"> / </span>
                <span>{{ paginationMeta.total.toLocaleString() }}</span>
              </p>
              <nav class="flex shrink-0 items-center gap-1 sm:gap-1.5" aria-label="Tracking pagination">
                <button
                  type="button"
                  class="inline-flex h-9 min-w-[4.25rem] items-center justify-center rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-semibold text-zinc-800 shadow-sm shadow-zinc-950/[0.04] transition-colors hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:pointer-events-none disabled:border-zinc-200 disabled:bg-zinc-50 disabled:text-zinc-400 disabled:shadow-none sm:h-auto sm:min-w-[5.5rem] sm:rounded-xl sm:px-3.5 sm:py-2.5 sm:text-[0.8125rem]"
                  :disabled="currentPage === 1"
                  @click="currentPage -= 1"
                >
                  <span class="sm:hidden">Prev</span>
                  <span class="hidden sm:inline">Previous</span>
                </button>
                <span class="whitespace-nowrap px-1 text-center text-xs font-medium tabular-nums text-zinc-500 sm:min-w-[6.5rem] sm:text-[0.8125rem]">
                  <span class="sm:hidden">{{ currentPage }}/{{ totalPages }}</span>
                  <span class="hidden sm:inline">Page {{ currentPage }} / {{ totalPages }}</span>
                </span>
                <button
                  type="button"
                  class="inline-flex h-9 min-w-[4.25rem] items-center justify-center rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-semibold text-zinc-800 shadow-sm shadow-zinc-950/[0.04] transition-colors hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:pointer-events-none disabled:border-zinc-200 disabled:bg-zinc-50 disabled:text-zinc-400 disabled:shadow-none sm:h-auto sm:min-w-[5.5rem] sm:rounded-xl sm:px-3.5 sm:py-2.5 sm:text-[0.8125rem]"
                  :disabled="currentPage === totalPages"
                  @click="currentPage += 1"
                >
                  Next
                </button>
              </nav>
            </div>
          </template>
        </div>
      </div>
    </div>

    <div
      v-else
      class="flex flex-col items-center rounded-2xl border border-dashed border-zinc-200 bg-white px-4 py-14 text-center shadow-sm shadow-zinc-950/[0.04] sm:px-6 sm:py-20"
    >
      <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500">
        <svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </div>
      <h3 class="mt-5 text-lg font-semibold text-zinc-900">
        {{ campaignId?.trim() ? 'No tracking events for this campaign yet' : 'No events in this report' }}
      </h3>
      <p class="mt-2 max-w-sm text-sm text-zinc-500">
        {{
          campaignId?.trim()
            ? 'After this campaign sends, delivery, opens, and clicks will appear here. Try the main Tracking page if you expect older activity.'
            : 'After you send campaigns, opens, clicks, and delivery events will show up here.'
        }}
      </p>
    </div>
  </div>
</template>
