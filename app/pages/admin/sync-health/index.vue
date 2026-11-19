<script setup lang="ts">
import type {
  MarketingSyncDlqEntry,
  MarketingSyncHealthLog,
  MarketingSyncHealthLogKind,
  MarketingSyncHealthLogLevel,
  MarketingSyncHealthStatus,
  MarketingSyncWorkerHealth
} from '~~/shared/marketingSyncHealth'
import {
  isoMatchesBrevoTrackingRange,
  SYNC_HEALTH_DATE_PRESET_OPTIONS,
  useBrevoTrackingDateRange
} from '~/composables/useBrevoTrackingDateRange'

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

const STATUS_RANK: Record<MarketingSyncHealthStatus, number> = {
  error: 0,
  degraded: 1,
  syncing: 2,
  ok: 3,
  unknown: 4
}

const route = useRoute()
const router = useRouter()

const statusFilter = ref<'all' | MarketingSyncHealthStatus>('all')
const tenantSearch = ref('')
const historySearch = ref('')
const logLevelFilter = ref<'all' | MarketingSyncHealthLogLevel>('all')
const historyKindFilter = ref<HistoryKindFilter>('all')
const autoRefresh = ref(true)
const showRunbookTips = ref(false)
const actionPending = ref(false)
const actionError = ref('')
const dlqActionId = ref<string | null>(null)

const {
  datePreset,
  customDateFrom,
  customDateTo,
  effectiveDateRange,
  dateRangeLabel
} = useBrevoTrackingDateRange()

datePreset.value = 'all'

const syncHealthDateLabel = computed(() => {
  if (datePreset.value === 'all') return 'All time'
  if (datePreset.value === 'custom') {
    if (customDateFrom.value.trim() && customDateTo.value.trim()) return dateRangeLabel.value
    return 'Custom range'
  }
  return dateRangeLabel.value
})

function applyQueryFiltersFromRoute() {
  const q = route.query
  const status = typeof q.status === 'string' ? q.status.trim() : ''
  if (
    status === 'ok' ||
    status === 'syncing' ||
    status === 'degraded' ||
    status === 'error' ||
    status === 'unknown'
  ) {
    statusFilter.value = status
  }
  if (typeof q.q === 'string') tenantSearch.value = q.q
  if (typeof q.hq === 'string') historySearch.value = q.hq
  const kind = typeof q.kind === 'string' ? q.kind.trim() : ''
  if (kind === 'all' || kind === 'sync' || kind === 'contact' || kind === 'error' || kind === 'dlq') {
    historyKindFilter.value = kind
  }
  const level = typeof q.level === 'string' ? q.level.trim() : ''
  if (level === 'all' || level === 'info' || level === 'warn' || level === 'error') {
    logLevelFilter.value = level
  }
  const preset = typeof q.date === 'string' ? q.date.trim() : ''
  if (
    preset === 'today' ||
    preset === 'yesterday' ||
    preset === 'mtd' ||
    preset === 'ytd' ||
    preset === 'all' ||
    preset === 'custom'
  ) {
    datePreset.value = preset
  }
  if (typeof q.from === 'string') customDateFrom.value = q.from
  if (typeof q.to === 'string') customDateTo.value = q.to
  if (q.refresh === '0') autoRefresh.value = false
}

applyQueryFiltersFromRoute()

const { data, pending, error, refresh } = await useAsyncData('admin-sync-health', () => {
  const reqFetch = import.meta.server ? useRequestFetch() : $fetch
  return reqFetch<AdminSyncHealthResponse>('/api/v1/admin/sync-health', {
    credentials: 'include'
  })
})

watch(
  [statusFilter, tenantSearch, historySearch, historyKindFilter, logLevelFilter, datePreset, customDateFrom, customDateTo, autoRefresh],
  () => {
    const query: Record<string, string> = {}
    if (statusFilter.value !== 'all') query.status = statusFilter.value
    if (tenantSearch.value.trim()) query.q = tenantSearch.value.trim()
    if (historySearch.value.trim()) query.hq = historySearch.value.trim()
    if (historyKindFilter.value !== 'all') query.kind = historyKindFilter.value
    if (logLevelFilter.value !== 'all') query.level = logLevelFilter.value
    if (datePreset.value !== 'all') query.date = datePreset.value
    if (datePreset.value === 'custom') {
      if (customDateFrom.value.trim()) query.from = customDateFrom.value.trim()
      if (customDateTo.value.trim()) query.to = customDateTo.value.trim()
    }
    if (!autoRefresh.value) query.refresh = '0'
    void router.replace({ query })
  }
)

async function ackDlqEntry(id: string, event?: Event) {
  event?.stopPropagation()
  if (!id || actionPending.value) return
  actionPending.value = true
  dlqActionId.value = id
  actionError.value = ''
  try {
    await $fetch(`/api/v1/admin/sync-health/dlq/${encodeURIComponent(id)}/ack`, {
      method: 'POST',
      credentials: 'include'
    })
    await refresh()
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : 'Failed to acknowledge DLQ entry'
  } finally {
    actionPending.value = false
    dlqActionId.value = null
  }
}

async function replayDlqEntry(id: string, event?: Event) {
  event?.stopPropagation()
  if (!id || actionPending.value) return
  if (!window.confirm('Replay this DLQ payload, then remove it from the queue?')) return
  actionPending.value = true
  dlqActionId.value = id
  actionError.value = ''
  try {
    await $fetch(`/api/v1/admin/sync-health/dlq/${encodeURIComponent(id)}/replay`, {
      method: 'POST',
      credentials: 'include'
    })
    await refresh()
  } catch (err) {
    const dataMessage =
      err && typeof err === 'object' && 'data' in err
        ? (err as { data?: { statusMessage?: string; message?: string } }).data
        : undefined
    actionError.value =
      dataMessage?.statusMessage ||
      dataMessage?.message ||
      (err instanceof Error ? err.message : 'Replay failed')
  } finally {
    actionPending.value = false
    dlqActionId.value = null
  }
}

async function clearTenantHealth(row: AdminSyncHealthTenantRow, event?: Event) {
  event?.stopPropagation()
  if (!row.dbName || actionPending.value) return
  if (!window.confirm(`Clear sticky error / stuck syncing for ${row.tenantName || row.dbName}?`)) {
    return
  }
  actionPending.value = true
  actionError.value = ''
  try {
    await $fetch(`/api/v1/admin/sync-health/${encodeURIComponent(row.dbName)}/clear`, {
      method: 'POST',
      credentials: 'include',
      body: { tenantId: row.tenantId || '' }
    })
    await refresh()
  } catch (err) {
    const dataMessage =
      err && typeof err === 'object' && 'data' in err
        ? (err as { data?: { statusMessage?: string; message?: string } }).data
        : undefined
    actionError.value =
      dataMessage?.statusMessage ||
      dataMessage?.message ||
      (err instanceof Error ? err.message : 'Clear failed')
  } finally {
    actionPending.value = false
  }
}

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
  const q = tenantSearch.value.trim().toLowerCase()
  const rows = [...(data.value?.tenants ?? [])]
  return rows
    .filter((row) => {
      if (statusFilter.value !== 'all' && row.status !== statusFilter.value) return false
      if (!q) return true
      const hay =
        `${row.tenantName || ''} ${row.dbName} ${row.tenantId} ${row.kafkaTopic || ''} ${row.lastContactEmail || ''} ${row.lastError || ''}`.toLowerCase()
      return hay.includes(q)
    })
    .sort((a, b) => {
      const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status]
      if (rank !== 0) return rank
      return (a.tenantName || a.dbName).localeCompare(b.tenantName || b.dbName)
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
  const q = historySearch.value.trim().toLowerCase()
  const range = effectiveDateRange.value
  const rows = data.value?.dlq ?? []
  return rows.filter((row) => {
    if (!isoMatchesBrevoTrackingRange(row.at, range)) return false
    if (!q) return true
    const tenantLabel = row.dbName ? tenantNameByDb.value.get(row.dbName) || '' : ''
    const hay =
      `${row.error} ${row.dbName || ''} ${row.tenantId || ''} ${tenantLabel} ${row.eventType || ''} ${row.kafkaTopic || ''} ${row.offset || ''}`.toLowerCase()
    return hay.includes(q)
  })
})

const filteredHistory = computed(() => {
  const q = historySearch.value.trim().toLowerCase()
  const range = effectiveDateRange.value
  const rows = data.value?.logs ?? []
  return rows.filter((log) => {
    if (logLevelFilter.value !== 'all' && log.level !== logLevelFilter.value) return false
    if (!matchesHistoryKind(log.kind, historyKindFilter.value)) return false
    if (!isoMatchesBrevoTrackingRange(log.at, range)) return false
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
    { label: 'OK', key: 'ok' as const, value: s?.ok ?? 0, accent: 'text-emerald-700' },
    { label: 'Syncing', key: 'syncing' as const, value: s?.syncing ?? 0, accent: 'text-sky-700' },
    { label: 'Degraded', key: 'degraded' as const, value: s?.degraded ?? 0, accent: 'text-amber-700' },
    { label: 'Error', key: 'error' as const, value: s?.error ?? 0, accent: 'text-rose-700' },
    { label: 'Unknown', key: 'unknown' as const, value: s?.unknown ?? 0, accent: 'text-slate-700' }
  ]
})

const attentionCount = computed(() => {
  const s = data.value?.summary
  return (s?.error ?? 0) + (s?.degraded ?? 0) + (s?.syncing ?? 0)
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

function logAccentClass(level: MarketingSyncHealthLogLevel): string {
  switch (level) {
    case 'error':
      return 'border-l-rose-500'
    case 'warn':
      return 'border-l-amber-400'
    default:
      return 'border-l-slate-300'
  }
}

function tileAccentRing(key: MarketingSyncHealthStatus): string {
  switch (key) {
    case 'ok':
      return 'ring-emerald-300'
    case 'syncing':
      return 'ring-sky-300'
    case 'degraded':
      return 'ring-amber-300'
    case 'error':
      return 'ring-rose-300'
    default:
      return 'ring-slate-300'
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

function clearStatusFilter() {
  statusFilter.value = 'all'
}

function csvEscape(value: string | number | null | undefined): string {
  const text = value == null ? '' : String(value)
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

const reportPending = ref(false)
const reportFormatPending = ref<'csv' | 'pdf' | null>(null)
const reportModalOpen = ref(false)
const reportTenantSearch = ref('')
const reportSelectedDbNames = ref<string[]>([])

if (import.meta.client) {
  let refreshTimer: ReturnType<typeof setInterval> | null = null
  const startAutoRefresh = () => {
    if (refreshTimer) clearInterval(refreshTimer)
    refreshTimer = setInterval(() => {
      if (!autoRefresh.value || pending.value || reportPending.value || actionPending.value) return
      void refresh()
    }, 30_000)
  }
  onMounted(startAutoRefresh)
  onBeforeUnmount(() => {
    if (refreshTimer) clearInterval(refreshTimer)
  })
  watch(autoRefresh, (on) => {
    if (on) startAutoRefresh()
    else if (refreshTimer) {
      clearInterval(refreshTimer)
      refreshTimer = null
    }
  })
}

const reportModalTenants = computed(() => {
  const q = reportTenantSearch.value.trim().toLowerCase()
  const rows = [...(data.value?.tenants ?? [])].sort((a, b) =>
    (a.tenantName || a.dbName).localeCompare(b.tenantName || b.dbName)
  )
  if (!q) return rows
  return rows.filter((row) => {
    const hay = `${row.tenantName || ''} ${row.dbName} ${row.tenantId} ${row.status}`.toLowerCase()
    return hay.includes(q)
  })
})

const reportSelectedCount = computed(() => reportSelectedDbNames.value.length)

const reportAllVisibleSelected = computed(() => {
  const visible = reportModalTenants.value
  if (visible.length === 0) return false
  const selected = new Set(reportSelectedDbNames.value)
  return visible.every((row) => selected.has(row.dbName))
})

function openReportModal(dbNames?: string[]) {
  if (!data.value || reportPending.value) return
  reportTenantSearch.value = ''
  reportSelectedDbNames.value =
    dbNames && dbNames.length > 0
      ? [...dbNames]
      : filteredTenants.value.map((row) => row.dbName)
  reportModalOpen.value = true
}

function openTenantReportModal(row: AdminSyncHealthTenantRow, event: Event) {
  event.stopPropagation()
  openReportModal([row.dbName])
}

function closeReportModal() {
  if (reportPending.value) return
  reportModalOpen.value = false
}

function isReportTenantSelected(dbName: string): boolean {
  return reportSelectedDbNames.value.includes(dbName)
}

function toggleReportTenant(dbName: string) {
  const next = new Set(reportSelectedDbNames.value)
  if (next.has(dbName)) next.delete(dbName)
  else next.add(dbName)
  reportSelectedDbNames.value = [...next]
}

function selectAllReportTenants() {
  const next = new Set(reportSelectedDbNames.value)
  for (const row of reportModalTenants.value) next.add(row.dbName)
  reportSelectedDbNames.value = [...next]
}

function clearAllReportTenants() {
  reportSelectedDbNames.value = []
}

function clearReportTenantSelection() {
  if (!reportTenantSearch.value.trim()) {
    clearAllReportTenants()
    return
  }
  const visible = new Set(reportModalTenants.value.map((row) => row.dbName))
  reportSelectedDbNames.value = reportSelectedDbNames.value.filter((dbName) => !visible.has(dbName))
}

function toggleAllVisibleReportTenants() {
  if (reportAllVisibleSelected.value) clearReportTenantSelection()
  else selectAllReportTenants()
}

function buildReportPayload() {
  const selected = new Set(reportSelectedDbNames.value)
  const dateLabel = syncHealthDateLabel.value
  const tenants = (data.value?.tenants ?? []).filter((row) => selected.has(row.dbName))
  const events = filteredHistory.value.filter((log) => !log.dbName || selected.has(log.dbName))
  const dlq = filteredDlq.value.filter((row) => !row.dbName || selected.has(row.dbName))
  const summary: Record<MarketingSyncHealthStatus, number> = {
    ok: 0,
    syncing: 0,
    degraded: 0,
    error: 0,
    unknown: 0
  }
  for (const row of tenants) summary[row.status] += 1
  return { tenants, events, dlq, summary, selectedCount: selected.size, dateLabel }
}

function reportStamp(iso: string): string {
  return iso.slice(0, 19).replace(/[:T]/g, '-')
}

function generateCsvReport() {
  if (!data.value || reportPending.value || reportSelectedCount.value === 0) return
  reportPending.value = true
  reportFormatPending.value = 'csv'
  try {
    const generatedAt = new Date().toISOString()
    const { tenants, events, dlq, summary, dateLabel } = buildReportPayload()
    const lines: string[] = [
      '# Sync health report — selected tenants',
      `# Generated at,${csvEscape(generatedAt)}`,
      `# Worker status,${csvEscape(data.value.worker.status)}`,
      `# Worker heartbeat,${csvEscape(data.value.worker.lastHeartbeatAt || '')}`,
      `# Selected tenants,${csvEscape(String(tenants.length))}`,
      `# Date range,${csvEscape(dateLabel)}`,
      `# Event filter,${csvEscape(historyKindFilter.value)}`,
      `# Level filter,${csvEscape(logLevelFilter.value)}`,
      `# History search,${csvEscape(historySearch.value.trim() || '(none)')}`,
      `# Counts,tenants=${tenants.length};events=${events.length};dlq=${dlq.length}`,
      '',
      '## Summary',
      'status,count',
      `ok,${summary.ok}`,
      `syncing,${summary.syncing}`,
      `degraded,${summary.degraded}`,
      `error,${summary.error}`,
      `unknown,${summary.unknown}`,
      '',
      '## Tenants',
      'tenantName,dbName,tenantId,status,mode,chunk,synced,lastContact,lastContactAt,lastContactEmail,lastSuccessAt,lastErrorAt,lastError,kafkaTopic'
    ]

    for (const row of tenants) {
      lines.push(
        [
          csvEscape(row.tenantName || row.dbName),
          csvEscape(row.dbName),
          csvEscape(row.tenantId),
          csvEscape(row.status),
          csvEscape(row.lastSyncMode || ''),
          csvEscape(chunkLabel(row) === '—' ? '' : chunkLabel(row)),
          csvEscape(row.lastSyncedCount ?? ''),
          csvEscape(lastContactLabel(row) === '—' ? '' : lastContactLabel(row)),
          csvEscape(row.lastContactEventAt || ''),
          csvEscape(row.lastContactEmail || ''),
          csvEscape(row.lastSuccessAt || ''),
          csvEscape(row.lastErrorAt || ''),
          csvEscape(row.lastError || ''),
          csvEscape(row.kafkaTopic || '')
        ].join(',')
      )
    }

    lines.push(
      '',
      '## Events',
      'at,level,kind,tenant,dbName,eventType,contactType,email,externalId,contactName,syncId,chunkIndex,chunkCount,message'
    )
    for (const log of events) {
      lines.push(
        [
          csvEscape(log.at),
          csvEscape(log.level),
          csvEscape(log.kind),
          csvEscape(log.dbName ? tenantNameByDb.value.get(log.dbName) || log.dbName : ''),
          csvEscape(log.dbName || ''),
          csvEscape(log.eventType || ''),
          csvEscape(log.contactType || ''),
          csvEscape(log.email || ''),
          csvEscape(log.externalId || ''),
          csvEscape(log.contactName || ''),
          csvEscape(log.syncId || ''),
          csvEscape(log.chunkIndex ?? ''),
          csvEscape(log.chunkCount ?? ''),
          csvEscape(log.message)
        ].join(',')
      )
    }

    lines.push(
      '',
      '## Dead letter queue',
      'at,tenant,dbName,eventType,kafkaTopic,partition,offset,error,rawPreview'
    )
    for (const row of dlq) {
      lines.push(
        [
          csvEscape(row.at),
          csvEscape(row.dbName ? tenantNameByDb.value.get(row.dbName) || row.dbName : ''),
          csvEscape(row.dbName || ''),
          csvEscape(row.eventType || ''),
          csvEscape(row.kafkaTopic || ''),
          csvEscape(row.partition ?? ''),
          csvEscape(row.offset ?? ''),
          csvEscape(row.error),
          csvEscape(row.rawPreview || '')
        ].join(',')
      )
    }

    downloadTextFile(`sync-health-tenants-${reportStamp(generatedAt)}.csv`, `${lines.join('\n')}\n`)
    reportModalOpen.value = false
  } finally {
    reportPending.value = false
    reportFormatPending.value = null
  }
}

async function generatePdfReport() {
  if (!data.value || reportPending.value || reportSelectedCount.value === 0) return
  reportPending.value = true
  reportFormatPending.value = 'pdf'
  try {
    const [{ jsPDF }, { autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable')
    ])
    const generatedAt = new Date().toISOString()
    const { tenants, events, dlq, summary, dateLabel } = buildReportPayload()
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
    const marginX = 36
    const pageHeight = doc.internal.pageSize.getHeight()
    let cursorY = 40

    const lastTableY = () =>
      (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? cursorY

    const ensureSpace = (needed = 48) => {
      if (cursorY + needed <= pageHeight - 36) return
      doc.addPage()
      cursorY = 40
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text('Sync health report — selected tenants', marginX, cursorY)
    cursorY += 18

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    for (const line of [
      `Worker: ${data.value.worker.status} · heartbeat ${formatWhen(data.value.worker.lastHeartbeatAt)}`,
      `Selected tenants: ${tenants.length}`,
      `Date range: ${dateLabel}`,
      `Event: ${historyKindFilter.value} · Level: ${logLevelFilter.value}`,
      `Generated: ${formatWhen(generatedAt)}`,
      `Counts: ${tenants.length} tenants · ${events.length} events · ${dlq.length} DLQ`
    ]) {
      doc.text(line, marginX, cursorY)
      cursorY += 14
    }

    autoTable(doc, {
      startY: cursorY + 6,
      head: [['Status', 'Count']],
      body: [
        ['OK', String(summary.ok)],
        ['Syncing', String(summary.syncing)],
        ['Degraded', String(summary.degraded)],
        ['Error', String(summary.error)],
        ['Unknown', String(summary.unknown)]
      ],
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [51, 65, 85] },
      margin: { left: marginX, right: marginX }
    })
    cursorY = lastTableY() + 16

    ensureSpace()
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Tenants', marginX, cursorY)
    autoTable(doc, {
      startY: cursorY + 8,
      head: [['Tenant', 'Status', 'Mode', 'Synced', 'Last contact', 'Error']],
      body:
        tenants.length > 0
          ? tenants.map((row) => [
              row.tenantName || row.dbName,
              row.status,
              row.lastSyncMode || '—',
              row.lastSyncedCount != null ? String(row.lastSyncedCount) : '—',
              lastContactLabel(row),
              (row.lastError || '—').slice(0, 80)
            ])
          : [['—', '—', '—', '—', '—', 'No tenants selected']],
      styles: { fontSize: 7, cellPadding: 3, overflow: 'linebreak' },
      headStyles: { fillColor: [51, 65, 85] },
      columnStyles: { 0: { cellWidth: 120 }, 5: { cellWidth: 180 } },
      margin: { left: marginX, right: marginX }
    })
    cursorY = lastTableY() + 16

    ensureSpace()
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Events', marginX, cursorY)
    autoTable(doc, {
      startY: cursorY + 8,
      head: [['When', 'Level', 'Tenant', 'Event', 'Message']],
      body:
        events.length > 0
          ? events.map((log) => [
              formatWhen(log.at),
              log.level,
              log.dbName ? tenantNameByDb.value.get(log.dbName) || log.dbName : '—',
              log.eventType || log.kind,
              (log.message || '—').slice(0, 100)
            ])
          : [['—', '—', '—', '—', 'No events for selected tenants']],
      styles: { fontSize: 7, cellPadding: 3, overflow: 'linebreak' },
      headStyles: { fillColor: [51, 65, 85] },
      columnStyles: { 4: { cellWidth: 240 } },
      margin: { left: marginX, right: marginX }
    })
    cursorY = lastTableY() + 16

    ensureSpace()
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Dead letter queue', marginX, cursorY)
    autoTable(doc, {
      startY: cursorY + 8,
      head: [['When', 'Tenant', 'Event', 'Topic / offset', 'Error']],
      body:
        dlq.length > 0
          ? dlq.map((row) => [
              formatWhen(row.at),
              row.dbName ? tenantNameByDb.value.get(row.dbName) || row.dbName : '—',
              row.eventType || '—',
              `${row.kafkaTopic || '—'}${row.offset != null ? ` p${row.partition ?? '?'} @ ${row.offset}` : ''}`,
              (row.error || '—').slice(0, 120)
            ])
          : [['—', '—', '—', '—', 'No dead-lettered messages']],
      styles: { fontSize: 7, cellPadding: 3, overflow: 'linebreak' },
      headStyles: { fillColor: [51, 65, 85] },
      columnStyles: { 4: { cellWidth: 220 } },
      margin: { left: marginX, right: marginX }
    })

    doc.save(`sync-health-tenants-${reportStamp(generatedAt)}.pdf`)
    reportModalOpen.value = false
  } finally {
    reportPending.value = false
    reportFormatPending.value = null
  }
}

</script>

<template>
  <section class="mx-auto w-full min-w-0 max-w-6xl space-y-5 sm:space-y-6">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0 space-y-1">
        <p class="page-eyebrow">Ops</p>
        <h1 class="page-title">Sync health</h1>
        <p class="page-lead">
          Kafka ingest status across tenants. Click a tenant for full sync history.
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <label class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">
          <input v-model="autoRefresh" type="checkbox" class="rounded border-slate-300 text-slate-900 focus:ring-slate-400">
          Auto 30s
        </label>
        <button
          type="button"
          class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          @click="showRunbookTips = !showRunbookTips"
        >
          Runbook
        </button>
        <TenantRefreshIconButton
          label="Refresh sync health"
          :pending="pending"
          @click="() => void refresh()"
        />
      </div>
    </header>

    <p v-if="pending && !data" class="text-sm text-slate-500">Loading sync health…</p>

    <div
      v-if="loadError"
      class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
    >
      {{ loadError }}
    </div>

    <div
      v-if="actionError"
      class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
    >
      {{ actionError }}
    </div>

    <div
      v-if="showRunbookTips"
      class="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950"
    >
      <p class="font-semibold">Stuck backlog checklist</p>
      <ul class="mt-2 list-disc space-y-1 pl-5 text-amber-900/90">
        <li>Confirm Kafka consumer is healthy (single instance, no rebalancing storm).</li>
        <li>Remove dead registry clients whose topics no longer exist.</li>
        <li>Bump consumer group only when intentionally skipping old backlog.</li>
        <li>Replay or ack DLQ rows after fixing the root cause.</li>
      </ul>
      <p class="mt-2 text-xs text-amber-800/80">
        Full write-up: <code>docs/marketing-sync-stuck-backlog-runbook.md</code>
      </p>
    </div>

    <template v-if="data">
      <div
        v-if="data.worker.status === 'stale' || data.worker.status === 'unknown' || (data.dlq?.length || 0) > 0"
        class="rounded-xl border px-4 py-3 text-sm"
        :class="
          data.worker.status === 'stale' || (data.dlq?.length || 0) > 0
            ? 'border-amber-200 bg-amber-50 text-amber-950'
            : 'border-slate-200 bg-slate-50 text-slate-700'
        "
      >
        <p class="font-semibold">Ops alert</p>
        <ul class="mt-1 list-disc space-y-0.5 pl-5">
          <li v-if="data.worker.status === 'stale'">
            Worker heartbeat is stale — inbound consumer may be down or stuck.
          </li>
          <li v-else-if="data.worker.status === 'unknown'">
            No worker heartbeat recorded yet.
          </li>
          <li v-if="(data.dlq?.length || 0) > 0">
            {{ data.dlq.length }} dead-lettered message{{ data.dlq.length === 1 ? '' : 's' }} need
            replay or ack.
          </li>
        </ul>
      </div>
      <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <div class="rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3 sm:col-span-2 lg:col-span-1">
          <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Worker
          </p>
          <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span
              class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset"
              :class="statusBadgeClass(data.worker.status)"
            >
              {{ data.worker.status }}
            </span>
          </div>
          <p class="mt-1.5 text-[11px] text-slate-500">
            {{ formatWhen(data.worker.lastHeartbeatAt) }}
          </p>
          <p
            v-if="(data.dlq?.length || 0) > 0"
            class="mt-1 text-[11px] font-medium text-rose-700"
          >
            {{ data.dlq.length }} DLQ
          </p>
        </div>

        <button
          v-for="tile in summaryTiles"
          :key="tile.key"
          type="button"
          class="rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3 text-left transition hover:border-slate-300"
          :class="statusFilter === tile.key ? `ring-2 ${tileAccentRing(tile.key)}` : ''"
          @click="statusFilter = statusFilter === tile.key ? 'all' : tile.key"
        >
          <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {{ tile.label }}
          </p>
          <p
            class="mt-1 text-xl font-semibold tabular-nums"
            :class="tile.value > 0 ? tile.accent : 'text-slate-400'"
          >
            {{ tile.value }}
          </p>
        </button>
      </div>

      <section class="space-y-2.5">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex min-w-0 flex-wrap items-center gap-2">
            <h2 class="text-sm font-semibold text-slate-900">Tenants</h2>
            <span class="text-xs tabular-nums text-slate-400">
              {{ filteredTenants.length }}
              <template v-if="filteredTenants.length !== (data.tenants?.length || 0)">
                of {{ data.tenants.length }}
              </template>
            </span>
            <button
              v-if="statusFilter !== 'all'"
              type="button"
              class="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white"
              @click="clearStatusFilter"
            >
              {{ statusFilter }}
              <span aria-hidden="true">×</span>
            </button>
            <span
              v-if="attentionCount > 0 && statusFilter === 'all'"
              class="text-[11px] font-medium text-amber-700"
            >
              {{ attentionCount }} need attention
            </span>
          </div>
          <p class="text-xs text-slate-400">
            Updated {{ formatWhen(data.generatedAt) }}
          </p>
        </div>

        <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label class="block min-w-0 flex-1">
            <span class="sr-only">Search tenants</span>
            <input
              v-model="tenantSearch"
              type="search"
              placeholder="Search tenants, email, error…"
              class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-slate-300 placeholder:text-slate-400 focus:ring-2"
            >
          </label>
          <div class="flex shrink-0 flex-wrap items-center gap-2">
            <TenantBrevoTrackingDateRangePicker
              v-model:preset="datePreset"
              v-model:custom-from="customDateFrom"
              v-model:custom-to="customDateTo"
              :label="syncHealthDateLabel"
              :preset-options="SYNC_HEALTH_DATE_PRESET_OPTIONS"
              default-preset="all"
            />
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!data || reportPending || pending"
              @click="openReportModal()"
            >
              <svg
                class="h-4 w-4 text-slate-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.75"
                  d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16"
                />
              </svg>
              Report
            </button>
          </div>
        </div>

        <div class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
          <div class="overflow-x-auto">
            <table class="min-w-full text-left text-sm">
              <thead class="border-b border-slate-100 bg-slate-50/70 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                <tr>
                  <th class="px-3 py-2.5">Tenant</th>
                  <th class="px-3 py-2.5">Status</th>
                  <th class="px-3 py-2.5">Mode</th>
                  <th class="px-3 py-2.5">Chunk</th>
                  <th class="px-3 py-2.5">Synced</th>
                  <th class="px-3 py-2.5">Last contact</th>
                  <th class="px-3 py-2.5">Success</th>
                  <th class="px-3 py-2.5">Error</th>
                  <th class="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in filteredTenants"
                  :key="`${row.tenantId}::${row.dbName}`"
                  class="cursor-pointer border-b border-slate-50 align-middle last:border-0 hover:bg-slate-50/90"
                  @click="navigateTo(tenantHistoryPath(row.dbName))"
                >
                  <td class="px-3 py-2.5">
                    <p class="font-medium text-slate-900">
                      {{ row.tenantName || row.dbName }}
                    </p>
                    <p class="truncate text-[11px] text-slate-500">{{ row.dbName }}</p>
                  </td>
                  <td class="px-3 py-2.5">
                    <span
                      class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset"
                      :class="statusBadgeClass(row.status)"
                    >
                      {{ row.status }}
                    </span>
                  </td>
                  <td class="px-3 py-2.5 text-slate-600">
                    {{ row.lastSyncMode || '—' }}
                  </td>
                  <td class="px-3 py-2.5 tabular-nums text-slate-600">
                    {{ chunkLabel(row) }}
                  </td>
                  <td class="px-3 py-2.5 tabular-nums text-slate-600">
                    {{ typeof row.lastSyncedCount === 'number' ? row.lastSyncedCount : '—' }}
                  </td>
                  <td class="max-w-[11rem] px-3 py-2.5">
                    <p class="truncate text-slate-700">{{ lastContactLabel(row) }}</p>
                    <p class="text-[11px] text-slate-400">{{ formatWhen(row.lastContactEventAt) }}</p>
                  </td>
                  <td class="whitespace-nowrap px-3 py-2.5 text-[13px] text-slate-500">
                    {{ formatWhen(row.lastSuccessAt) }}
                  </td>
                  <td class="max-w-[12rem] px-3 py-2.5">
                    <p
                      v-if="row.lastError"
                      class="truncate text-[12px] font-medium text-rose-700"
                      :title="row.lastError"
                    >
                      {{ row.lastError }}
                    </p>
                    <p v-else class="text-[13px] text-slate-400">
                      {{ formatWhen(row.lastErrorAt) }}
                    </p>
                  </td>
                  <td class="px-3 py-2.5">
                    <div class="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        class="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        :disabled="actionPending || pending"
                        :aria-label="`Clear health for ${row.tenantName || row.dbName}`"
                        @click="(e) => void clearTenantHealth(row, e)"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        class="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        :disabled="reportPending || pending"
                        :aria-label="`Generate report for ${row.tenantName || row.dbName}`"
                        @click="openTenantReportModal(row, $event)"
                      >
                        Report
                      </button>
                      <span class="text-slate-300" aria-hidden="true">›</span>
                    </div>
                  </td>
                </tr>
                <tr v-if="filteredTenants.length === 0">
                  <td colspan="9" class="px-4 py-10 text-center text-sm text-slate-500">
                    No tenants match this filter.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div class="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] lg:items-start">
        <section class="min-w-0 space-y-2.5">
          <div class="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <h2 class="text-sm font-semibold text-slate-900">Event history</h2>
            <p class="text-xs text-slate-400">
              {{ filteredHistory.length }} shown
              <template v-if="filteredHistory.length !== (data.logs?.length || 0)">
                of {{ data.logs.length }}
              </template>
            </p>
          </div>

          <div class="rounded-2xl border border-slate-200/80 bg-white">
            <div class="space-y-2.5 border-b border-slate-100 px-3 py-3">
              <label class="block min-w-0">
                <span class="sr-only">Search events</span>
                <input
                  v-model="historySearch"
                  type="search"
                  placeholder="Search events, tenant, email…"
                  class="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-900 outline-none ring-slate-300 placeholder:text-slate-400 focus:bg-white focus:ring-2"
                >
              </label>
              <div
                class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4"
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

            <div class="max-h-[28rem] overflow-y-auto">
              <div
                v-for="log in filteredHistory"
                :key="log.id"
                class="border-b border-l-4 border-slate-100 px-3 py-2.5 last:border-b-0"
                :class="logAccentClass(log.level)"
              >
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="text-[11px] tabular-nums text-slate-500">{{ formatWhen(log.at) }}</span>
                  <span
                    class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset"
                    :class="logLevelClass(log.level)"
                  >
                    {{ log.level }}
                  </span>
                  <span class="text-[11px] capitalize text-slate-400">{{ log.kind }}</span>
                  <span
                    v-if="log.contactType"
                    class="rounded bg-violet-50 px-1.5 py-0.5 text-[11px] font-medium text-violet-700"
                  >
                    {{ log.contactType }}
                  </span>
                  <NuxtLink
                    v-if="log.dbName"
                    :to="tenantHistoryPath(log.dbName)"
                    class="rounded bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium text-sky-700 hover:bg-sky-100"
                    @click.stop
                  >
                    {{ tenantNameByDb.get(log.dbName) || log.dbName }}
                  </NuxtLink>
                </div>
                <p class="mt-1 whitespace-pre-wrap break-words text-sm text-slate-900">
                  {{ log.message }}
                </p>
                <p
                  v-if="log.eventType || log.syncId || log.email || log.externalId"
                  class="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-slate-500"
                >
                  <span v-if="log.eventType" class="font-mono">{{ log.eventType }}</span>
                  <span v-if="log.email">{{ log.email }}</span>
                  <span v-if="log.externalId">id {{ log.externalId }}</span>
                  <span v-if="log.syncId" class="font-mono">sync {{ log.syncId }}</span>
                </p>
              </div>

              <p
                v-if="filteredHistory.length === 0"
                class="px-4 py-10 text-center text-sm text-slate-500"
              >
                {{
                  (data.logs?.length || 0) === 0
                    ? 'No history yet. Events appear after the inbound worker processes them.'
                    : 'No events match this filter.'
                }}
              </p>
            </div>
          </div>
        </section>

        <section class="min-w-0 space-y-2.5">
          <div class="flex items-baseline justify-between gap-3">
            <h2 class="text-sm font-semibold text-slate-900">Dead letter queue</h2>
            <p
              class="text-xs tabular-nums"
              :class="filteredDlq.length ? 'font-medium text-rose-600' : 'text-slate-400'"
            >
              {{ filteredDlq.length }}
            </p>
          </div>

          <div class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
            <div
              v-for="row in filteredDlq"
              :key="row.id"
              class="space-y-1 border-b border-slate-100 px-3 py-2.5 last:border-0"
              :class="row.dbName ? 'cursor-pointer hover:bg-rose-50/40' : ''"
              @click="row.dbName && navigateTo(tenantHistoryPath(row.dbName))"
            >
              <div class="flex flex-wrap items-center justify-between gap-1.5">
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="text-[11px] text-slate-500">{{ formatWhen(row.at) }}</span>
                  <span
                    v-if="row.eventType"
                    class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700"
                  >
                    {{ row.eventType }}
                  </span>
                  <span
                    v-if="row.dbName"
                    class="rounded bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium text-rose-700"
                  >
                    {{ tenantNameByDb.get(row.dbName) || row.dbName }}
                  </span>
                </div>
                <div class="flex items-center gap-1" @click.stop>
                  <button
                    type="button"
                    class="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    :disabled="actionPending || !row.rawPreview"
                    @click="() => void replayDlqEntry(row.id)"
                  >
                    {{ dlqActionId === row.id && actionPending ? '…' : 'Replay' }}
                  </button>
                  <button
                    type="button"
                    class="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    :disabled="actionPending"
                    @click="() => void ackDlqEntry(row.id)"
                  >
                    Ack
                  </button>
                </div>
              </div>
              <p class="break-words text-sm font-medium text-rose-700" :title="row.error">
                {{ row.error }}
              </p>
              <p class="font-mono text-[11px] text-slate-500">
                {{ row.kafkaTopic || '—' }}
                <template v-if="row.offset != null">
                  · p{{ row.partition ?? '?' }} @ {{ row.offset }}
                </template>
              </p>
            </div>

            <p
              v-if="filteredDlq.length === 0"
              class="px-4 py-10 text-center text-sm text-slate-500"
            >
              No dead-lettered messages.
            </p>
          </div>
        </section>
      </div>
    </template>

    <Teleport to="body">
      <div
        v-if="reportModalOpen"
        class="fixed inset-0 z-[220] flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sync-health-report-modal-title"
        @click.self="closeReportModal"
        @keydown.esc="closeReportModal"
      >
        <div
          class="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-2xl ring-1 ring-slate-200/60 sm:rounded-2xl"
        >
          <div class="border-b border-slate-100 px-5 py-4">
            <h3
              id="sync-health-report-modal-title"
              class="text-lg font-semibold text-slate-900"
            >
              Generate report
            </h3>
            <p class="mt-1 text-sm text-slate-600">
              Choose which tenants to include. Events and DLQ use the board date range
              ({{ syncHealthDateLabel }}).
            </p>
          </div>

          <div class="space-y-3 border-b border-slate-100 px-5 py-3">
            <input
              v-model="reportTenantSearch"
              type="search"
              placeholder="Search tenants…"
              class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-slate-300 placeholder:text-slate-400 focus:ring-2"
            >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="text-xs text-slate-500">
                {{ reportSelectedCount }} selected
                <span v-if="reportTenantSearch.trim()">
                  · {{ reportModalTenants.length }} shown
                </span>
                · {{ syncHealthDateLabel }}
              </p>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                  :disabled="reportPending || reportModalTenants.length === 0"
                  @click="toggleAllVisibleReportTenants"
                >
                  {{ reportAllVisibleSelected ? 'Clear visible' : 'Select visible' }}
                </button>
                <button
                  type="button"
                  class="rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                  :disabled="reportPending || reportSelectedCount === 0"
                  @click="clearAllReportTenants"
                >
                  Clear all
                </button>
              </div>
            </div>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto px-2 py-2">
            <label
              v-for="row in reportModalTenants"
              :key="row.dbName"
              class="flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 transition hover:bg-slate-50"
            >
              <input
                type="checkbox"
                class="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                :checked="isReportTenantSelected(row.dbName)"
                :disabled="reportPending"
                @change="toggleReportTenant(row.dbName)"
              >
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium text-slate-900">
                  {{ row.tenantName || row.dbName }}
                </span>
                <span class="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                  <span class="font-mono">{{ row.dbName }}</span>
                  <span
                    class="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset"
                    :class="statusBadgeClass(row.status)"
                  >
                    {{ row.status }}
                  </span>
                </span>
              </span>
            </label>
            <p
              v-if="reportModalTenants.length === 0"
              class="px-3 py-10 text-center text-sm text-slate-500"
            >
              No tenants match this search.
            </p>
          </div>

          <div
            class="flex flex-col-reverse gap-2 border-t border-slate-100 px-5 py-4 sm:flex-row sm:justify-end sm:gap-3"
          >
            <button
              type="button"
              class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="reportPending"
              @click="closeReportModal"
            >
              Cancel
            </button>
            <button
              type="button"
              class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="reportPending || reportSelectedCount === 0"
              @click="generateCsvReport"
            >
              {{ reportFormatPending === 'csv' ? 'CSV…' : 'Download CSV' }}
            </button>
            <button
              type="button"
              class="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="reportPending || reportSelectedCount === 0"
              @click="() => void generatePdfReport()"
            >
              {{ reportFormatPending === 'pdf' ? 'PDF…' : 'Download PDF' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>
