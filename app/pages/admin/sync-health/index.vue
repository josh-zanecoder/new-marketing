<script setup lang="ts">
import type {
  MarketingSyncDlqEntry,
  MarketingSyncHealthLog,
  MarketingSyncHealthLogKind,
  MarketingSyncHealthLogLevel,
  MarketingSyncHealthStatus,
  MarketingSyncWorkerHealth
} from '~~/shared/marketingSyncHealth'

definePageMeta({ layout: 'admin' })

type AdminSyncHealthTenantRow = {
  tenantId: string
  dbName: string
  tenantName?: string
  kafkaTopic?: string
  status: MarketingSyncHealthStatus
  lastSyncMode?: string
  lastSyncId?: string
  lastSyncedCount?: number
  lastChunkIndex?: number
  lastChunkCount?: number
  lastEventType?: string
  lastError?: string
  lastContactEventAt?: string
  lastContactEventType?: string
  lastContactType?: string
  lastContactExternalId?: string
  lastContactEmail?: string
  lastSuccessAt?: string
  lastErrorAt?: string
  lastEventAt?: string
  updatedAt: string
  registryTenantId?: string
}

type AdminSyncHealthResponse = {
  generatedAt: string
  worker: MarketingSyncWorkerHealth
  summary: Record<MarketingSyncHealthStatus, number>
  tenants: AdminSyncHealthTenantRow[]
  logs: MarketingSyncHealthLog[]
  dlq: MarketingSyncDlqEntry[]
}

type HistoryKindFilter = 'all' | 'sync' | 'contact' | 'error' | 'dlq'

const historyKindOptions: { value: HistoryKindFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'sync', label: 'Sync' },
  { value: 'contact', label: 'Contacts' },
  { value: 'error', label: 'Failures' },
  { value: 'dlq', label: 'DLQ' }
]

const historyLevelOptions: { value: 'all' | MarketingSyncHealthLogLevel; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'info', label: 'Info' },
  { value: 'warn', label: 'Warn' },
  { value: 'error', label: 'Error' }
]

const statusFilter = ref<'all' | MarketingSyncHealthStatus>('all')
const search = ref('')
const logLevelFilter = ref<'all' | MarketingSyncHealthLogLevel>('all')
const historyKindFilter = ref<HistoryKindFilter>('all')

const { data, pending, error, refresh } = await useAsyncData('admin-sync-health', () => {
  const reqFetch = import.meta.server ? useRequestFetch() : $fetch
  return reqFetch<AdminSyncHealthResponse>('/api/v1/admin/sync-health', {
    credentials: 'include'
  })
})

const loadError = computed(() => {
  const err = error.value
  if (!err) return ''
  const dataMessage =
    err && typeof err === 'object' && 'data' in err
      ? (err as { data?: { message?: string; statusMessage?: string } }).data
      : undefined
  return (
    dataMessage?.message ||
    dataMessage?.statusMessage ||
    (err instanceof Error ? err.message : '') ||
    'Unable to load sync health.'
  )
})

const tenantNameByDb = computed(() => {
  const map = new Map<string, string>()
  for (const row of data.value?.tenants ?? []) {
    map.set(row.dbName, row.tenantName || row.dbName)
  }
  return map
})

const filteredTenants = computed(() => {
  const q = search.value.trim().toLowerCase()
  const rows = data.value?.tenants ?? []
  return rows.filter((row) => {
    if (statusFilter.value !== 'all' && row.status !== statusFilter.value) return false
    if (!q) return true
    const hay = `${row.tenantName || ''} ${row.dbName} ${row.tenantId} ${row.kafkaTopic || ''} ${row.lastContactEmail || ''}`.toLowerCase()
    return hay.includes(q)
  })
})

function matchesHistoryKind(kind: MarketingSyncHealthLogKind, filter: HistoryKindFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'contact') return kind === 'contact'
  if (filter === 'dlq') return kind === 'dlq'
  if (filter === 'error') return kind === 'error' || kind === 'worker' || kind === 'dlq'
  return kind === 'progress' || kind === 'success'
}

const filteredDlq = computed(() => {
  const q = search.value.trim().toLowerCase()
  const rows = data.value?.dlq ?? []
  return rows.filter((row) => {
    if (!q) return true
    const tenantLabel = row.dbName ? tenantNameByDb.value.get(row.dbName) || '' : ''
    const hay =
      `${row.error} ${row.dbName || ''} ${row.tenantId || ''} ${tenantLabel} ${row.eventType || ''} ${row.kafkaTopic || ''} ${row.offset || ''}`.toLowerCase()
    return hay.includes(q)
  })
})

const filteredHistory = computed(() => {
  const q = search.value.trim().toLowerCase()
  const rows = data.value?.logs ?? []
  return rows.filter((log) => {
    if (logLevelFilter.value !== 'all' && log.level !== logLevelFilter.value) return false
    if (!matchesHistoryKind(log.kind, historyKindFilter.value)) return false
    if (!q) return true
    const tenantLabel = log.dbName ? tenantNameByDb.value.get(log.dbName) || '' : ''
    const hay =
      `${log.message} ${log.dbName || ''} ${log.tenantId || ''} ${tenantLabel} ${log.eventType || ''} ${log.contactType || ''} ${log.email || ''} ${log.externalId || ''} ${log.contactName || ''}`.toLowerCase()
    return hay.includes(q)
  })
})

const summaryTiles = computed(() => {
  const s = data.value?.summary
  return [
    { label: 'OK', key: 'ok' as const, value: s?.ok ?? 0 },
    { label: 'Syncing', key: 'syncing' as const, value: s?.syncing ?? 0 },
    { label: 'Degraded', key: 'degraded' as const, value: s?.degraded ?? 0 },
    { label: 'Error', key: 'error' as const, value: s?.error ?? 0 },
    { label: 'Unknown', key: 'unknown' as const, value: s?.unknown ?? 0 }
  ]
})

function formatWhen(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

function statusBadgeClass(status: MarketingSyncHealthStatus | MarketingSyncWorkerHealth['status']): string {
  switch (status) {
    case 'ok':
      return 'bg-emerald-50 text-emerald-800 ring-emerald-200'
    case 'syncing':
      return 'bg-sky-50 text-sky-800 ring-sky-200'
    case 'degraded':
    case 'stale':
      return 'bg-amber-50 text-amber-900 ring-amber-200'
    case 'error':
      return 'bg-rose-50 text-rose-800 ring-rose-200'
    default:
      return 'bg-slate-100 text-slate-700 ring-slate-200'
  }
}

function logLevelClass(level: MarketingSyncHealthLogLevel): string {
  switch (level) {
    case 'error':
      return 'bg-rose-50 text-rose-800 ring-rose-200'
    case 'warn':
      return 'bg-amber-50 text-amber-900 ring-amber-200'
    default:
      return 'bg-slate-100 text-slate-700 ring-slate-200'
  }
}

function chunkLabel(row: AdminSyncHealthTenantRow): string {
  if (typeof row.lastChunkIndex !== 'number' || typeof row.lastChunkCount !== 'number') return '—'
  return `${row.lastChunkIndex}/${row.lastChunkCount}`
}

function lastContactLabel(row: AdminSyncHealthTenantRow): string {
  if (!row.lastContactEventAt) return '—'
  const type = row.lastContactType || 'contact'
  const action = row.lastContactEventType?.replace('contact.', '') || 'event'
  return `${type} ${action}`
}

function tenantHistoryPath(dbName: string): string {
  return `/admin/sync-health/${encodeURIComponent(dbName)}`
}
</script>

<template>
  <section class="mx-auto w-full min-w-0 max-w-6xl space-y-6 sm:space-y-8">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div class="min-w-0 space-y-1">
        <p class="page-eyebrow">Ops</p>
        <h1 class="page-title">Sync health</h1>
        <p class="page-lead">
          Global Kafka ingest status and history for sync + contact events. Open a tenant to view its sync history.
        </p>
      </div>
      <TenantRefreshIconButton
        label="Refresh sync health"
        :pending="pending"
        @click="() => void refresh()"
      />
    </header>

    <p v-if="pending && !data" class="text-sm text-slate-500">Loading sync health…</p>

    <div
      v-if="loadError"
      class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
    >
      {{ loadError }}
    </div>

    <template v-if="data">
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div class="rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3">
          <p class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Inbound worker
          </p>
          <div class="mt-2 flex flex-wrap items-center gap-2">
            <span
              class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset"
              :class="statusBadgeClass(data.worker.status)"
            >
              {{ data.worker.status }}
            </span>
            <span class="text-sm text-slate-600">
              Heartbeat {{ formatWhen(data.worker.lastHeartbeatAt) }}
            </span>
          </div>
          <p v-if="data.worker.consumerGroupId" class="mt-2 truncate text-xs text-slate-500">
            {{ data.worker.consumerGroupId }}
          </p>
          <p
            v-if="(data.dlq?.length || 0) > 0"
            class="mt-2 text-xs font-medium text-rose-700"
          >
            {{ data.dlq.length }} dead-lettered message{{ data.dlq.length === 1 ? '' : 's' }}
          </p>
        </div>

        <button
          v-for="tile in summaryTiles"
          :key="tile.key"
          type="button"
          class="rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 text-left transition hover:border-slate-300"
          :class="statusFilter === tile.key ? 'ring-2 ring-slate-300' : ''"
          @click="statusFilter = statusFilter === tile.key ? 'all' : tile.key"
        >
          <p class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {{ tile.label }}
          </p>
          <p class="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
            {{ tile.value }}
          </p>
        </button>
      </div>

      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label class="block min-w-0 flex-1">
          <span class="sr-only">Search tenants</span>
          <input
            v-model="search"
            type="search"
            placeholder="Search tenant, contact email, event…"
            class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-slate-300 placeholder:text-slate-400 focus:ring-2"
          >
        </label>
        <p class="text-xs text-slate-500">
          Updated {{ formatWhen(data.generatedAt) }} · {{ filteredTenants.length }} tenants
        </p>
      </div>

      <div class="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white/80">
        <table class="min-w-full text-left text-sm">
          <thead class="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <tr>
              <th class="px-4 py-3">Tenant</th>
              <th class="px-4 py-3">Status</th>
              <th class="px-4 py-3">Mode</th>
              <th class="px-4 py-3">Chunk</th>
              <th class="px-4 py-3">Synced</th>
              <th class="px-4 py-3">Last contact event</th>
              <th class="px-4 py-3">Last success</th>
              <th class="px-4 py-3">Last error</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in filteredTenants"
              :key="`${row.tenantId}::${row.dbName}`"
              class="cursor-pointer border-b border-slate-50 align-top last:border-0 hover:bg-slate-50/80"
              @click="navigateTo(tenantHistoryPath(row.dbName))"
            >
              <td class="px-4 py-3">
                <p class="font-medium text-slate-900">
                  {{ row.tenantName || row.dbName }}
                </p>
                <p class="mt-0.5 text-xs text-slate-500">{{ row.dbName }}</p>
                <p v-if="row.kafkaTopic" class="mt-0.5 truncate text-xs text-slate-400">
                  {{ row.kafkaTopic }}
                </p>
              </td>
              <td class="px-4 py-3">
                <span
                  class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset"
                  :class="statusBadgeClass(row.status)"
                >
                  {{ row.status }}
                </span>
              </td>
              <td class="px-4 py-3 text-slate-700">
                {{ row.lastSyncMode || '—' }}
              </td>
              <td class="px-4 py-3 tabular-nums text-slate-700">
                {{ chunkLabel(row) }}
              </td>
              <td class="px-4 py-3 tabular-nums text-slate-700">
                {{ typeof row.lastSyncedCount === 'number' ? row.lastSyncedCount : '—' }}
              </td>
              <td class="px-4 py-3">
                <p class="text-slate-700">{{ lastContactLabel(row) }}</p>
                <p class="text-xs text-slate-500">{{ formatWhen(row.lastContactEventAt) }}</p>
                <p v-if="row.lastContactEmail" class="mt-0.5 truncate text-xs text-slate-400">
                  {{ row.lastContactEmail }}
                </p>
              </td>
              <td class="px-4 py-3 text-slate-600">
                {{ formatWhen(row.lastSuccessAt) }}
              </td>
              <td class="px-4 py-3">
                <p class="text-slate-600">{{ formatWhen(row.lastErrorAt) }}</p>
                <p
                  v-if="row.lastError"
                  class="mt-1 max-w-xs text-xs text-rose-700"
                  :title="row.lastError"
                >
                  {{ row.lastError }}
                </p>
              </td>
            </tr>
            <tr v-if="filteredTenants.length === 0">
              <td colspan="8" class="px-4 py-8 text-center text-sm text-slate-500">
                No tenants match this filter.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <section class="space-y-3">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div class="min-w-0 space-y-1">
            <h2 class="text-base font-semibold text-slate-900">History</h2>
            <p class="text-sm text-slate-500">
              Recent sync and contact ingest events (including prospect / client / contact create-update-delete).
            </p>
          </div>
          <div
            class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4"
            role="group"
            aria-label="History filters"
          >
            <div class="flex min-w-0 flex-wrap items-center gap-2">
              <span class="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Event
              </span>
              <div class="inline-flex flex-wrap gap-1 rounded-lg bg-slate-100/80 p-0.5">
                <button
                  v-for="kind in historyKindOptions"
                  :key="kind.value"
                  type="button"
                  class="rounded-md px-2.5 py-1 text-xs font-semibold transition"
                  :class="
                    historyKindFilter === kind.value
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
                  "
                  @click="historyKindFilter = kind.value"
                >
                  {{ kind.label }}
                </button>
              </div>
            </div>
            <div class="hidden h-6 w-px bg-slate-200 sm:block" aria-hidden="true" />
            <div class="flex min-w-0 flex-wrap items-center gap-2">
              <span class="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Level
              </span>
              <div class="inline-flex flex-wrap gap-1 rounded-lg bg-slate-100/80 p-0.5">
                <button
                  v-for="level in historyLevelOptions"
                  :key="level.value"
                  type="button"
                  class="rounded-md px-2.5 py-1 text-xs font-semibold transition"
                  :class="
                    logLevelFilter === level.value
                      ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                      : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
                  "
                  @click="logLevelFilter = level.value"
                >
                  {{ level.label }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-950 text-slate-100">
          <div class="max-h-[32rem] overflow-y-auto font-mono text-xs leading-relaxed">
            <div
              v-for="log in filteredHistory"
              :key="log.id"
              class="border-b border-white/5 px-4 py-2.5 last:border-0"
            >
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-slate-400">{{ formatWhen(log.at) }}</span>
                <span
                  class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset"
                  :class="logLevelClass(log.level)"
                >
                  {{ log.level }}
                </span>
                <span class="text-slate-500">{{ log.kind }}</span>
                <span v-if="log.contactType" class="text-violet-300">{{ log.contactType }}</span>
                <NuxtLink
                  v-if="log.dbName"
                  :to="tenantHistoryPath(log.dbName)"
                  class="text-sky-300 hover:text-sky-200"
                >
                  {{ tenantNameByDb.get(log.dbName) || log.dbName }}
                </NuxtLink>
              </div>
              <p class="mt-1 whitespace-pre-wrap break-words text-slate-100">
                {{ log.message }}
              </p>
              <p
                v-if="log.eventType || log.syncId || log.email || log.externalId"
                class="mt-1 text-slate-500"
              >
                <span v-if="log.eventType">{{ log.eventType }}</span>
                <span v-if="log.email"> · {{ log.email }}</span>
                <span v-if="log.externalId"> · id {{ log.externalId }}</span>
                <span v-if="log.syncId"> · sync {{ log.syncId }}</span>
                <span v-if="typeof log.chunkIndex === 'number' && typeof log.chunkCount === 'number'">
                  · chunk {{ log.chunkIndex }}/{{ log.chunkCount }}
                </span>
              </p>
            </div>
            <p
              v-if="filteredHistory.length === 0"
              class="px-4 py-8 text-center text-sm text-slate-400"
            >
              No history yet. Contact create/update/delete and sync events appear after the inbound worker processes them.
            </p>
          </div>
        </div>
      </section>

      <section class="space-y-3">
        <div class="min-w-0 space-y-1">
          <h2 class="text-base font-semibold text-slate-900">Dead letter queue</h2>
          <p class="text-sm text-slate-500">
            Skipped Kafka messages (handler errors that no longer crash the shared worker). Use topic/offset to investigate; recover with a tenant delta/full sync.
          </p>
        </div>

        <div class="overflow-x-auto rounded-2xl border border-rose-200/80 bg-white/80">
          <table class="min-w-full text-left text-sm">
            <thead class="border-b border-rose-100 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th class="px-4 py-3">When</th>
                <th class="px-4 py-3">Tenant</th>
                <th class="px-4 py-3">Event</th>
                <th class="px-4 py-3">Topic / offset</th>
                <th class="px-4 py-3">Error</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in filteredDlq"
                :key="row.id"
                class="border-b border-slate-50 align-top last:border-0 hover:bg-rose-50/40"
                :class="row.dbName ? 'cursor-pointer' : ''"
                @click="row.dbName && navigateTo(tenantHistoryPath(row.dbName))"
              >
                <td class="px-4 py-3 text-slate-600">
                  {{ formatWhen(row.at) }}
                </td>
                <td class="px-4 py-3">
                  <NuxtLink
                    v-if="row.dbName"
                    :to="tenantHistoryPath(row.dbName)"
                    class="font-medium text-slate-900 hover:text-primary-700"
                  >
                    {{ tenantNameByDb.get(row.dbName) || row.dbName }}
                  </NuxtLink>
                  <p v-else class="font-medium text-slate-900">—</p>
                  <p v-if="row.dbName" class="text-xs text-slate-500">{{ row.dbName }}</p>
                </td>
                <td class="px-4 py-3 text-slate-700">
                  {{ row.eventType || '—' }}
                </td>
                <td class="px-4 py-3 font-mono text-xs text-slate-600">
                  <p>{{ row.kafkaTopic || '—' }}</p>
                  <p v-if="row.offset != null">
                    p{{ row.partition ?? '?' }} @ {{ row.offset }}
                  </p>
                </td>
                <td class="px-4 py-3">
                  <p class="max-w-md text-rose-700" :title="row.error">
                    {{ row.error }}
                  </p>
                  <p
                    v-if="row.rawPreview"
                    class="mt-1 max-w-md truncate font-mono text-[10px] text-slate-400"
                    :title="row.rawPreview"
                  >
                    {{ row.rawPreview }}
                  </p>
                </td>
              </tr>
              <tr v-if="filteredDlq.length === 0">
                <td colspan="5" class="px-4 py-8 text-center text-sm text-slate-500">
                  No dead-lettered messages.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </section>
</template>
