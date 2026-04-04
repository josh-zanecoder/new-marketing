<script setup lang="ts">
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
    panelTitle?: string
    panelHint?: string
    cardClass?: string
  }>(),
  {
    panelTitle: 'Email events',
    panelHint: '',
    cardClass: 'rounded-lg border border-gray-200 bg-white shadow-sm'
  }
)

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

type DatePresetId = 'all' | 'today' | 'yesterday' | 'lastWeek' | 'lastMonth' | 'mtd' | 'ytd' | 'custom'

const datePreset = ref<DatePresetId>('all')
const customDateFrom = ref('')
const customDateTo = ref('')

const datePresetOptions: { id: DatePresetId; label: string }[] = [
  { id: 'all', label: 'All time' },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'lastWeek', label: 'Last week' },
  { id: 'lastMonth', label: 'Last month' },
  { id: 'mtd', label: 'MTD' },
  { id: 'ytd', label: 'YTD' },
  { id: 'custom', label: 'Custom' }
]

function toYmdLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Local midnight Monday of the week containing `d` (week starts Monday). */
function mondayOfWeekContaining(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = x.getDay()
  const daysSinceMon = (dow + 6) % 7
  x.setDate(x.getDate() - daysSinceMon)
  return x
}

function presetToRange(preset: DatePresetId, now: Date): { from: string | null; to: string | null } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const ymdToday = toYmdLocal(today)

  if (preset === 'all' || preset === 'custom') return { from: null, to: null }
  if (preset === 'today') return { from: ymdToday, to: ymdToday }

  if (preset === 'yesterday') {
    const y = new Date(today)
    y.setDate(y.getDate() - 1)
    const ymd = toYmdLocal(y)
    return { from: ymd, to: ymd }
  }

  if (preset === 'lastWeek') {
    const monThis = mondayOfWeekContaining(today)
    const monPrev = new Date(monThis)
    monPrev.setDate(monPrev.getDate() - 7)
    const sunPrev = new Date(monPrev)
    sunPrev.setDate(sunPrev.getDate() + 6)
    return { from: toYmdLocal(monPrev), to: toYmdLocal(sunPrev) }
  }

  if (preset === 'lastMonth') {
    const firstThis = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastPrev = new Date(firstThis.getTime() - 1)
    const firstPrev = new Date(lastPrev.getFullYear(), lastPrev.getMonth(), 1)
    return { from: toYmdLocal(firstPrev), to: toYmdLocal(lastPrev) }
  }

  if (preset === 'mtd') {
    const first = new Date(now.getFullYear(), now.getMonth(), 1)
    return { from: toYmdLocal(first), to: ymdToday }
  }

  if (preset === 'ytd') {
    const first = new Date(now.getFullYear(), 0, 1)
    return { from: toYmdLocal(first), to: ymdToday }
  }

  return { from: null, to: null }
}

const effectiveDateRange = computed((): { from: string | null; to: string | null } => {
  if (datePreset.value === 'custom') {
    const from = customDateFrom.value.trim() || null
    const to = customDateTo.value.trim() || null
    return { from, to }
  }
  return presetToRange(datePreset.value, new Date())
})

function localDayStartMs(iso: string): number {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return NaN
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function inputYmdToStartMs(ymd: string): number | null {
  if (!ymd.trim()) return null
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d).getTime()
}

function groupMatchesDateRange(
  g: MessageEventGroup,
  range: { from: string | null; to: string | null }
): boolean {
  const latest = groupLatestIso(g)
  if (!latest) return true
  const day = localDayStartMs(latest)
  if (Number.isNaN(day)) return true
  if (!range.from && !range.to) return true
  const fromMs = range.from ? inputYmdToStartMs(range.from) : null
  const toMs = range.to ? inputYmdToStartMs(range.to) : null
  if (fromMs != null && day < fromMs) return false
  if (toMs != null && day > toMs) return false
  return true
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

const groupsAfterSearchDate = computed(() => {
  const range = effectiveDateRange.value
  return messageGroups.value.filter(
    (g) => groupMatchesDateRange(g, range) && groupMatchesSearch(g)
  )
})

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

const displayedEventCount = computed(() =>
  tableRows.value.reduce((n, r) => n + r.events.length, 0)
)

function isMailinatorEmail(email: string | undefined): boolean {
  if (!email?.trim()) return false
  const domain = email.trim().split('@')[1]?.toLowerCase() ?? ''
  return domain === 'mailinator.com' || domain.endsWith('.mailinator.com')
}

const mailinatorCountFiltered = computed(() => {
  let n = 0
  for (const row of tableRows.value) {
    for (const e of row.events) {
      if (isMailinatorEmail(e.email)) n++
    }
  }
  return n
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
  if (e === 'delivered') return 'bg-emerald-100 text-emerald-800 ring-emerald-600/20'
  if (e === 'requests' || e === 'sent') return 'bg-sky-100 text-sky-800 ring-sky-600/20'
  if (e.includes('bounce') || e === 'hard_bounces' || e === 'soft_bounces')
    return 'bg-rose-100 text-rose-800 ring-rose-600/20'
  if (e.includes('open') || e === 'unique_opened') return 'bg-violet-100 text-violet-800 ring-violet-600/20'
  if (e.includes('click')) return 'bg-amber-100 text-amber-800 ring-amber-600/20'
  return 'bg-gray-100 text-gray-700 ring-gray-500/20'
}

function clearAllFilters() {
  searchQuery.value = ''
  datePreset.value = 'all'
  customDateFrom.value = ''
  customDateTo.value = ''
  clearEventFilters()
}

const defaultHintAllTenant =
  'Table is grouped by message ID. Last week is the previous Mon–Sun; MTD / YTD use your local calendar. Data is tenant-scoped on the server.'

const defaultHintCampaign =
  'Brevo events for this campaign only. Filters apply on top of server-side campaign and tenant rules.'

const hintText = computed(() => {
  if (props.panelHint?.trim()) return props.panelHint.trim()
  if (props.campaignId?.trim()) return defaultHintCampaign
  return defaultHintAllTenant
})

const dateRangeFilterActive = computed(() => {
  if (datePreset.value === 'all') return false
  if (datePreset.value === 'custom') {
    return !!(customDateFrom.value.trim() || customDateTo.value.trim())
  }
  return true
})

const hasActiveFilters = computed(
  () =>
    !!searchQuery.value.trim() ||
    dateRangeFilterActive.value ||
    selectedEventTypes.value.length > 0
)

const dateSelectClass =
  'w-full max-w-xs rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 sm:w-52'
</script>

<template>
  <div>
    <div v-if="pending" class="text-sm text-gray-500">Loading event report…</div>
    <p v-else-if="error" class="text-sm text-red-600">
      {{ error.message || 'Failed to load event report' }}
    </p>

    <div v-else-if="events.length > 0" :class="['overflow-hidden', cardClass]">
      <div class="border-b border-gray-200 bg-gray-50 px-4 py-3">
        <div class="flex flex-wrap items-baseline justify-between gap-3">
          <h2 class="text-sm font-medium text-gray-900">{{ panelTitle }}</h2>
          <div class="flex flex-wrap items-center gap-3 text-xs">
            <span class="rounded-md bg-white px-2 py-1 font-medium text-gray-800 ring-1 ring-gray-200">
              Events: <span class="tabular-nums">{{ displayedEventCount }}</span>
            </span>
            <span class="rounded-md bg-white px-2 py-1 font-medium text-gray-800 ring-1 ring-gray-200">
              Messages: <span class="tabular-nums">{{ tableRows.length }}</span>
            </span>
            <span
              class="rounded-md px-2 py-1 font-medium ring-1 ring-inset"
              :class="
                mailinatorCountFiltered > 0
                  ? 'bg-amber-50 text-amber-900 ring-amber-200'
                  : 'bg-white text-gray-600 ring-gray-200'
              "
            >
              Mailinator:
              <span class="tabular-nums">{{ mailinatorCountFiltered }}</span>
            </span>
          </div>
        </div>
        <p class="mt-2 text-xs text-gray-500">{{ hintText }}</p>
      </div>

      <div class="space-y-3 border-b border-gray-100 bg-white px-4 py-3">
        <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-3">
          <label class="block min-w-0 flex-1 sm:max-w-xs">
            <span class="mb-1 block text-xs font-medium text-gray-600">Search</span>
            <input
              v-model="searchQuery"
              type="search"
              autocomplete="off"
              placeholder="Subject, email, message ID, campaign ID, tags…"
              class="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            >
          </label>
          <label class="block shrink-0">
            <span class="mb-1 block text-xs font-medium text-gray-600">Date range</span>
            <select v-model="datePreset" :class="dateSelectClass">
              <option v-for="opt in datePresetOptions" :key="opt.id" :value="opt.id">
                {{ opt.label }}
              </option>
            </select>
          </label>
          <button
            v-if="hasActiveFilters"
            type="button"
            class="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            @click="clearAllFilters"
          >
            Clear filters
          </button>
        </div>
        <div
          v-if="datePreset === 'custom'"
          class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-3"
        >
          <label class="block sm:w-40">
            <span class="mb-1 block text-xs font-medium text-gray-500">Custom from</span>
            <input
              v-model="customDateFrom"
              type="date"
              class="w-full rounded-md border border-gray-200 px-2 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            >
          </label>
          <label class="block sm:w-40">
            <span class="mb-1 block text-xs font-medium text-gray-500">Custom to</span>
            <input
              v-model="customDateTo"
              type="date"
              class="w-full rounded-md border border-gray-200 px-2 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            >
          </label>
        </div>
        <div v-if="availableEventTypes.length" class="border-t border-gray-100 pt-3">
          <p class="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Event type</p>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="rounded-full px-3 py-1 text-xs font-medium ring-1 transition"
              :class="
                selectedEventTypes.length === 0
                  ? 'bg-gray-900 text-white ring-gray-900'
                  : 'bg-white text-gray-700 ring-gray-200 hover:bg-gray-50'
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
              class="rounded-full px-3 py-1 text-xs font-medium capitalize ring-1 transition"
              :class="
                selectedEventTypes.includes(t)
                  ? 'bg-gray-900 text-white ring-gray-900'
                  : 'bg-white text-gray-700 ring-gray-200 hover:bg-gray-50'
              "
              @click="toggleEventFilter(t)"
            >
              {{ t }}
              <span class="ml-1 tabular-nums opacity-90">({{ countMessagesWithEventType(t) }})</span>
            </button>
          </div>
        </div>
      </div>

      <div v-if="tableRows.length === 0" class="px-4 py-10 text-center text-sm text-gray-500">
        No messages match your filters.
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[52rem] text-left text-sm">
          <thead>
            <tr
              class="border-b border-gray-200 bg-gray-50/90 text-xs font-semibold uppercase tracking-wide text-gray-600"
            >
              <th scope="col" class="px-4 py-3">Campaign</th>
              <th scope="col" class="min-w-[9rem] px-4 py-3">Recipient</th>
              <th scope="col" class="min-w-[10rem] px-4 py-3">Subject</th>
              <th scope="col" class="whitespace-nowrap px-4 py-3">Date</th>
              <th scope="col" class="px-4 py-3">Events</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr
              v-for="(row, idx) in tableRows"
              :key="`${row.messageId}-${idx}`"
              class="hover:bg-gray-50/80"
            >
              <td class="px-4 py-3 align-top">
                <NuxtLink
                  v-if="row.campaignId && isMongoId(row.campaignId)"
                  :to="`/tenant/campaigns/${row.campaignId}`"
                  class="text-sm text-sky-700 underline decoration-sky-700/40 hover:text-sky-900"
                  :title="row.campaignId"
                >
                  {{ campaignDisplayLabel(row.campaignId) }}
                </NuxtLink>
                <span v-else-if="row.campaignId" class="font-mono text-xs text-gray-800">{{
                  row.campaignId
                }}</span>
                <span v-else class="text-gray-400">—</span>
              </td>
              <td
                class="max-w-[14rem] break-all px-4 py-3 align-top text-sm text-gray-800"
                :class="{ 'text-gray-400': !row.recipientEmail?.trim() }"
              >
                {{ row.recipientEmail?.trim() || '—' }}
              </td>
              <td class="max-w-xs px-4 py-3 align-top text-gray-900" :title="row.subject">
                <span class="line-clamp-2">{{ row.subject }}</span>
              </td>
              <td class="whitespace-nowrap px-4 py-3 align-top tabular-nums text-gray-700">
                {{ formatEventDate(row.latestIso) }}
              </td>
              <td class="px-4 py-3 align-top">
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
    </div>

    <p v-else class="text-sm text-gray-500">No events in this report.</p>
  </div>
</template>
