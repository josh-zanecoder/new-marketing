<script setup lang="ts">
const props = defineProps<{
  campaignId?: string
}>()

type Health = {
  lastEventAt: string | null
  lastEventType: string | null
  lastWrittenAt: string | null
  eventsLast24h: number
  stale: boolean
  staleSinceHours: number | null
}

const query = computed(() => {
  const q: Record<string, string> = {}
  const id = props.campaignId?.trim()
  if (id) q.campaignId = id
  return q
})

const { data, pending, error, refresh } = useFetch<{ ok: boolean; health: Health }>(
  '/api/v1/tracking/webhook-health',
  {
    query,
    key: computed(() => `tracking-webhook-health-${props.campaignId?.trim() || 'all'}`),
    watch: [query]
  }
)

const health = computed(() => data.value?.health ?? null)

function formatWhen(iso: string | null): string {
  if (!iso) return 'never'
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return 'never'
  return d.toLocaleString()
}

defineExpose({ refresh })
</script>

<template>
  <div
    class="rounded-xl border px-3.5 py-2.5 text-sm"
    :class="
      health?.stale
        ? 'border-amber-200 bg-amber-50 text-amber-950'
        : 'border-zinc-200 bg-zinc-50 text-zinc-700'
    "
    :aria-busy="pending"
  >
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="min-w-0 font-medium">
        <span v-if="pending && !health">Checking tracking freshness…</span>
        <span v-else-if="error">Could not load webhook health.</span>
        <span v-else-if="health?.stale">
          Tracking looks stale
          <span v-if="health.staleSinceHours != null">
            (last write ~{{ health.staleSinceHours }}h ago)
          </span>
          — run Refresh or Deep refresh if opens/delivery look light.
        </span>
        <span v-else>Tracking is receiving events.</span>
      </p>
      <button
        type="button"
        class="shrink-0 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
        :disabled="pending"
        @click="refresh()"
      >
        Recheck
      </button>
    </div>
    <p v-if="health" class="mt-1 text-xs opacity-90">
      Last event: {{ formatWhen(health.lastEventAt)
      }}<template v-if="health.lastEventType"> ({{ health.lastEventType }})</template>
      · Last write: {{ formatWhen(health.lastWrittenAt) }}
      · Last 24h: {{ health.eventsLast24h }} event{{ health.eventsLast24h === 1 ? '' : 's' }}
    </p>
  </div>
</template>
