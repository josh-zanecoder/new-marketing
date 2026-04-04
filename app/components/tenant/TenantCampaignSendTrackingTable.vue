<script setup lang="ts">
interface BrevoEmailEvent {
  email?: string
  date?: string
  event?: string
}

interface BrevoEventReport {
  events?: BrevoEmailEvent[]
}

const props = defineProps<{
  campaignId: string
}>()

const query = computed(() => {
  const c = props.campaignId?.trim()
  return c ? { campaignId: c } : {}
})

const fetchKey = computed(() => `tenant-campaign-tracking-table-${props.campaignId.trim()}`)

const { data, error, pending } = useFetch<{ report: unknown }>('/api/v1/tracking', {
  query,
  key: fetchKey
})

const report = computed((): BrevoEventReport | null => {
  const r = data.value?.report
  if (r && typeof r === 'object' && r !== null && 'events' in r) {
    return r as BrevoEventReport
  }
  return null
})

const events = computed(() => report.value?.events ?? [])

/** One row per recipient email; event types in first-seen order (by Brevo date). */
const recipientRows = computed(() => {
  const list = events.value
  const sorted = [...list].sort(
    (a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime()
  )
  const order = new Map<string, string[]>()
  const displayEmail = new Map<string, string>()

  for (const e of sorted) {
    const raw = (e.email || '').trim()
    if (!raw) continue
    const key = raw.toLowerCase()
    if (!displayEmail.has(key)) displayEmail.set(key, raw)
    const ev = (e.event || '').trim()
    if (!ev) continue
    if (!order.has(key)) order.set(key, [])
    const arr = order.get(key)!
    if (!arr.includes(ev)) arr.push(ev)
  }

  return [...order.entries()].map(([key, eventTypes]) => ({
    email: displayEmail.get(key) ?? key,
    eventTypes
  }))
})

const availableEventTypes = computed(() => {
  const s = new Set<string>()
  for (const e of events.value) {
    const ev = (e.event || '').trim()
    if (ev) s.add(ev)
  }
  return [...s].sort((a, b) => a.localeCompare(b))
})

/** Recipients that have at least one occurrence of each event type (deduped per recipient per type). */
const recipientCountByEventType = computed(() => {
  const m = new Map<string, number>()
  for (const row of recipientRows.value) {
    for (const ev of row.eventTypes) {
      m.set(ev, (m.get(ev) ?? 0) + 1)
    }
  }
  return m
})

function recipientCountForEventType(t: string): number {
  return recipientCountByEventType.value.get(t) ?? 0
}

/** Selected event names; empty = show all (no filter). */
const selectedEventTypes = ref<string[]>([])

function toggleEventFilter(name: string) {
  const i = selectedEventTypes.value.indexOf(name)
  if (i === -1) selectedEventTypes.value = [...selectedEventTypes.value, name]
  else selectedEventTypes.value = selectedEventTypes.value.filter((_, j) => j !== i)
}

function clearEventFilters() {
  selectedEventTypes.value = []
}

const filteredRows = computed(() => {
  const rows = recipientRows.value
  const sel = selectedEventTypes.value
  if (!sel.length) return rows
  return rows
    .filter((r) => r.eventTypes.some((ev) => sel.includes(ev)))
    .map((r) => ({
      email: r.email,
      eventTypes: r.eventTypes.filter((ev) => sel.includes(ev))
    }))
})

function eventBadgeClass(ev: string | undefined): string {
  const e = (ev || '').toLowerCase()
  if (e === 'delivered') return 'bg-emerald-50 text-emerald-800 ring-emerald-200/80'
  if (e === 'requests' || e === 'sent') return 'bg-sky-50 text-sky-800 ring-sky-200/80'
  if (e.includes('bounce') || e === 'hardbounces' || e === 'softbounces')
    return 'bg-rose-50 text-rose-800 ring-rose-200/80'
  if (e.includes('open') || e === 'opened') return 'bg-violet-50 text-violet-800 ring-violet-200/80'
  if (e.includes('click') || e === 'clicks') return 'bg-amber-50 text-amber-800 ring-amber-200/80'
  return 'bg-zinc-100 text-zinc-700 ring-zinc-200/80'
}
</script>

<template>
  <div
    class="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm shadow-zinc-950/[0.04]"
  >
    <div class="border-b border-zinc-100 px-5 py-4 sm:px-6">
      <h2 class="text-xs font-semibold uppercase tracking-wider text-zinc-500">Send tracking</h2>
    </div>

    <div v-if="pending" class="px-5 py-8 text-sm text-zinc-500 sm:px-6">Loading…</div>
    <p v-else-if="error" class="px-5 py-6 text-sm text-red-600 sm:px-6">
      {{ error.message || 'Failed to load tracking' }}
    </p>

    <template v-else>
      <div
        v-if="availableEventTypes.length"
        class="border-b border-zinc-100 bg-zinc-50/50 px-5 py-3 sm:px-6"
      >
        <p class="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Filter by event</p>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-full px-3 py-1 text-xs font-medium ring-1 transition"
            :class="
              selectedEventTypes.length === 0
                ? 'bg-zinc-900 text-white ring-zinc-900'
                : 'bg-white text-zinc-700 ring-zinc-200 hover:bg-zinc-50'
            "
            @click="clearEventFilters"
          >
            All
            <span class="ml-1 tabular-nums opacity-90">({{ recipientRows.length }})</span>
          </button>
          <button
            v-for="t in availableEventTypes"
            :key="t"
            type="button"
            class="rounded-full px-3 py-1 text-xs font-medium capitalize ring-1 transition"
            :class="
              selectedEventTypes.includes(t)
                ? 'bg-zinc-900 text-white ring-zinc-900'
                : 'bg-white text-zinc-700 ring-zinc-200 hover:bg-zinc-50'
            "
            @click="toggleEventFilter(t)"
          >
            {{ t }}
            <span class="ml-1 tabular-nums opacity-90">({{ recipientCountForEventType(t) }})</span>
          </button>
        </div>
      </div>

      <div v-if="recipientRows.length === 0" class="px-5 py-10 text-center text-sm text-zinc-500 sm:px-6">
        No Brevo events for this campaign yet.
      </div>

      <div v-else-if="filteredRows.length === 0" class="px-5 py-10 text-center text-sm text-zinc-500 sm:px-6">
        No recipients match the selected event filters.
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[20rem] text-left text-sm">
          <thead>
            <tr class="border-b border-zinc-100 bg-zinc-50/80 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <th scope="col" class="px-5 py-3 sm:px-6">Recipient</th>
              <th scope="col" class="px-5 py-3 sm:px-6">Events</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-zinc-100">
            <tr
              v-for="row in filteredRows"
              :key="row.email"
              class="hover:bg-zinc-50/50"
            >
              <td class="whitespace-nowrap px-5 py-3.5 font-medium text-zinc-900 sm:px-6">
                {{ row.email }}
              </td>
              <td class="px-5 py-3.5 sm:px-6">
                <div class="flex flex-wrap gap-1.5">
                  <span
                    v-for="ev in row.eventTypes"
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
    </template>
  </div>
</template>
