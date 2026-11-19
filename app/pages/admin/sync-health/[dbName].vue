<script setup lang="ts">
import type {
  MarketingSyncDlqEntry,
  MarketingSyncHealthLog,
  MarketingSyncHealthLogKind,
  MarketingSyncHealthLogLevel,
  MarketingSyncHealthStatus,
  MarketingSyncRunSummary
} from '~~/shared/marketingSyncHealth'
import {
  isoMatchesBrevoTrackingRange,
  SYNC_HEALTH_DATE_PRESET_OPTIONS,
  useBrevoTrackingDateRange
} from '~/composables/useBrevoTrackingDateRange'
import {
  filterSyncHealthReportDlq,
  filterSyncHealthReportEvents,
  isValidSyncHealthReportCustomRange,
  syncHealthReportDateLabel
} from '~~/shared/utils/syncHealthReportDateRange'

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
}

type AdminSyncHealthResponse = {
  generatedAt: string
  tenants: AdminSyncHealthTenantRow[]
  dlq: MarketingSyncDlqEntry[]
}

type AdminTenantSyncHistoryResponse = {
  generatedAt: string
  dbName: string
  tenantName?: string
  tenantId?: string
  limit: number
  logCount: number
  logs: MarketingSyncHealthLog[]
  runs: MarketingSyncRunSummary[]
  dlq?: MarketingSyncDlqEntry[]
}

type HistoryKindFilter = 'all' | 'sync' | 'contact' | 'error' | 'dlq'

const route = useRoute()
const dbName = computed(() => decodeURIComponent(String(route.params.dbName || '')).trim())

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

const logLevelFilter = ref<'all' | MarketingSyncHealthLogLevel>('all')
const historyKindFilter = ref<HistoryKindFilter>('all')
const search = ref('')
const expandedSyncId = ref('')

const {
  datePreset,
  customDateFrom,
  customDateTo,
  effectiveDateRange,
  dateRangeLabel,
  resetDateRange
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

/** Independent of the event-history filter — used only by CSV/PDF report export. */
const {
  datePreset: reportDatePreset,
  customDateFrom: reportCustomDateFrom,
  customDateTo: reportCustomDateTo,
  effectiveDateRange: reportEffectiveDateRange
} = useBrevoTrackingDateRange()

reportDatePreset.value = 'all'

const reportDateLabel = computed(() =>
  syncHealthReportDateLabel({
    preset: reportDatePreset.value,
    customFrom: reportCustomDateFrom.value,
    customTo: reportCustomDateTo.value
  })
)

const reportDateRangeValid = computed(() => {
  if (reportDatePreset.value !== 'custom') return true
  return isValidSyncHealthReportCustomRange(
    reportCustomDateFrom.value,
    reportCustomDateTo.value
  )
})

const {
  data: history,
  pending: historyPending,
  error: historyError,
  refresh: refreshHistory
} = await useAsyncData(
  'admin-sync-health-tenant-history',
  () => {
    if (!dbName.value) return Promise.resolve(null)
    const reqFetch = import.meta.server ? useRequestFetch() : $fetch
    return reqFetch<AdminTenantSyncHistoryResponse>(
      `/api/v1/admin/sync-health/${encodeURIComponent(dbName.value)}/history`,
      { credentials: 'include' }
    )
  },
  { watch: [dbName] }
)

const {
  data: board,
  pending: boardPending,
  refresh: refreshBoard
} = await useAsyncData(
  'admin-sync-health-tenant-board',
  () => {
    if (!dbName.value) return Promise.resolve(null)
    const reqFetch = import.meta.server ? useRequestFetch() : $fetch
    return reqFetch<AdminSyncHealthResponse>('/api/v1/admin/sync-health', {
      credentials: 'include'
    })
  },
  { watch: [dbName] }
)

watch(dbName, () => {
  expandedSyncId.value = ''
  search.value = ''
  resetDateRange()
  datePreset.value = 'all'
  reportDatePreset.value = 'all'
  reportCustomDateFrom.value = ''
  reportCustomDateTo.value = ''
  historyKindFilter.value = 'all'
  logLevelFilter.value = 'all'
})

const tenantRow = computed(() =>
  (board.value?.tenants ?? []).find((row) => row.dbName === dbName.value) || null
)

const tenantLabel = computed(
  () => history.value?.tenantName || tenantRow.value?.tenantName || dbName.value || 'Tenant'
)

const tenantDlq = computed(() => {
  if (history.value?.dlq) return history.value.dlq
  return (board.value?.dlq ?? []).filter((row) => row.dbName === dbName.value)
})

const actionPending = ref(false)
const actionError = ref('')
const dlqActionId = ref<string | null>(null)
const showRunbookTips = ref(false)

async function clearTenantHealth() {
  if (!dbName.value || actionPending.value) return
  if (!window.confirm('Clear sticky error / stuck syncing state for this tenant?')) return
  actionPending.value = true
  actionError.value = ''
  try {
    await $fetch(`/api/v1/admin/sync-health/${encodeURIComponent(dbName.value)}/clear`, {
      method: 'POST',
      credentials: 'include',
      body: { tenantId: tenantRow.value?.tenantId || history.value?.tenantId || '' }
    })
    await Promise.all([refreshHistory(), refreshBoard()])
  } catch (err) {
    actionError.value =
      err && typeof err === 'object' && 'data' in err
        ? String(
            (err as { data?: { statusMessage?: string; message?: string } }).data?.statusMessage ||
              (err as { data?: { message?: string } }).data?.message ||
              'Clear failed'
          )
        : err instanceof Error
          ? err.message
          : 'Clear failed'
  } finally {
    actionPending.value = false
  }
}

async function ackDlqEntry(id: string) {
  if (!id || actionPending.value) return
  actionPending.value = true
  dlqActionId.value = id
  actionError.value = ''
  try {
    await $fetch(`/api/v1/admin/sync-health/dlq/${encodeURIComponent(id)}/ack`, {
      method: 'POST',
      credentials: 'include'
    })
    await Promise.all([refreshHistory(), refreshBoard()])
  } catch (err) {
    actionError.value =
      err instanceof Error ? err.message : 'Failed to acknowledge DLQ entry'
  } finally {
    actionPending.value = false
    dlqActionId.value = null
  }
}

async function replayDlqEntry(id: string) {
  if (!id || actionPending.value) return
  if (!window.confirm('Replay this DLQ payload through inbound handlers, then remove it from the queue?')) {
    return
  }
  actionPending.value = true
  dlqActionId.value = id
  actionError.value = ''
  try {
    await $fetch(`/api/v1/admin/sync-health/dlq/${encodeURIComponent(id)}/replay`, {
      method: 'POST',
      credentials: 'include'
    })
    await Promise.all([refreshHistory(), refreshBoard()])
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

const loadError = computed(() => {
  const err = historyError.value
  if (!err) return ''
  const dataMessage =
    err && typeof err === 'object' && 'data' in err
      ? (err as { data?: { message?: string; statusMessage?: string } }).data
      : undefined
  return (
    dataMessage?.message ||
    dataMessage?.statusMessage ||
    (err instanceof Error ? err.message : '') ||
    'Unable to load tenant sync history.'
  )
})

const summaryFacts = computed(() => {
  const row = tenantRow.value
  if (!row) return [] as { label: string; value: string; tone?: 'error' | 'muted' }[]
  const facts: { label: string; value: string; tone?: 'error' | 'muted' }[] = []

  if (row.lastSyncMode) facts.push({ label: 'Mode', value: row.lastSyncMode })
  if (typeof row.lastChunkIndex === 'number' && typeof row.lastChunkCount === 'number') {
    facts.push({ label: 'Chunk', value: `${row.lastChunkIndex}/${row.lastChunkCount}` })
  }
  if (typeof row.lastSyncedCount === 'number') {
    facts.push({ label: 'Synced', value: String(row.lastSyncedCount) })
  }
  if (row.lastSuccessAt) facts.push({ label: 'Last success', value: formatWhen(row.lastSuccessAt) })
  if (row.lastContactEventAt) {
    facts.push({ label: 'Last contact', value: `${lastContactLabel(row)} · ${formatWhen(row.lastContactEventAt)}` })
  }
  if (row.lastContactEmail) facts.push({ label: 'Contact email', value: row.lastContactEmail })
  if (row.lastErrorAt || row.lastError) {
    facts.push({
      label: 'Last error',
      value: row.lastError
        ? `${formatWhen(row.lastErrorAt)} · ${row.lastError}`
        : formatWhen(row.lastErrorAt),
      tone: 'error'
    })
  }
  if (row.kafkaTopic) facts.push({ label: 'Topic', value: row.kafkaTopic, tone: 'muted' })
  return facts
})

function matchesHistoryKind(kind: MarketingSyncHealthLogKind, filter: HistoryKindFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'contact') return kind === 'contact'
  if (filter === 'dlq') return kind === 'dlq'
  if (filter === 'error') return kind === 'error' || kind === 'worker' || kind === 'dlq'
  return kind === 'progress' || kind === 'success'
}

const filteredLogs = computed(() => {
  const q = search.value.trim().toLowerCase()
  const rows = history.value?.logs ?? []
  const range = effectiveDateRange.value
  return rows.filter((log) => {
    if (logLevelFilter.value !== 'all' && log.level !== logLevelFilter.value) return false
    if (!matchesHistoryKind(log.kind, historyKindFilter.value)) return false
    if (!isoMatchesBrevoTrackingRange(log.at, range)) return false
    if (!q) return true
    const hay =
      `${log.message} ${log.eventType || ''} ${log.contactType || ''} ${log.email || ''} ${log.externalId || ''} ${log.contactName || ''} ${log.syncId || ''}`.toLowerCase()
    return hay.includes(q)
  })
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

function statusBadgeClass(status: MarketingSyncHealthStatus | MarketingSyncRunSummary['status']): string {
  switch (status) {
    case 'ok':
      return 'bg-emerald-50 text-emerald-800 ring-emerald-200'
    case 'syncing':
      return 'bg-sky-50 text-sky-800 ring-sky-200'
    case 'degraded':
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

function lastContactLabel(row: AdminSyncHealthTenantRow): string {
  if (!row.lastContactEventAt) return '—'
  const type = row.lastContactType || 'contact'
  const action = row.lastContactEventType?.replace('contact.', '') || 'event'
  return `${type} ${action}`
}

function toggleSyncRun(syncId: string) {
  const key = syncId || '__orphan'
  expandedSyncId.value = expandedSyncId.value === key ? '' : key
}

function syncRunKey(run: MarketingSyncRunSummary): string {
  return run.syncId || '__orphan'
}

function runTitle(run: MarketingSyncRunSummary): string {
  if (run.syncMode) return `${run.syncMode} sync`
  if (run.lastMessage) return run.lastMessage
  return 'Sync run'
}

async function refreshAll() {
  await Promise.all([refreshHistory(), refreshBoard()])
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

type SyncHealthReportPayload = {
  generatedAt: string
  stamp: string
  runs: MarketingSyncRunSummary[]
  events: MarketingSyncHealthLog[]
  dlq: MarketingSyncDlqEntry[]
}

function buildReportPayload(): SyncHealthReportPayload | null {
  if (!history.value || !dbName.value) return null
  const range = reportEffectiveDateRange.value
  const selected = new Set([dbName.value])
  const generatedAt = new Date().toISOString()
  const q = search.value.trim().toLowerCase()
  // Report date range is independent of the event-history board filter.
  // Event / Level / Search still follow the page filters.
  const events = filterSyncHealthReportEvents(history.value.logs, selected, range).filter((log) => {
    if (logLevelFilter.value !== 'all' && log.level !== logLevelFilter.value) return false
    if (!matchesHistoryKind(log.kind, historyKindFilter.value)) return false
    if (!q) return true
    const hay =
      `${log.message} ${log.eventType || ''} ${log.contactType || ''} ${log.email || ''} ${log.externalId || ''} ${log.contactName || ''} ${log.syncId || ''}`.toLowerCase()
    return hay.includes(q)
  })
  const dlq = filterSyncHealthReportDlq(tenantDlq.value, selected, range).filter((row) => {
    if (!q) return true
    const hay =
      `${row.error} ${row.eventType || ''} ${row.kafkaTopic || ''} ${row.offset || ''}`.toLowerCase()
    return hay.includes(q)
  })
  return {
    generatedAt,
    stamp: generatedAt.slice(0, 19).replace(/[:T]/g, '-'),
    runs: (history.value.runs ?? []).filter((run) =>
      isoMatchesBrevoTrackingRange(run.startedAt || run.finishedAt, range)
    ),
    events,
    dlq
  }
}

const reportPending = ref(false)
const reportFormatPending = ref<'csv' | 'pdf' | null>(null)

const canGenerateReport = computed(
  () => Boolean(history.value) && reportDateRangeValid.value && !reportPending.value && !historyPending.value
)

function generateCsvReport() {
  const payload = buildReportPayload()
  if (!payload || !canGenerateReport.value) return
  reportPending.value = true
  reportFormatPending.value = 'csv'
  try {
    const { generatedAt, stamp, runs, events, dlq } = payload
    const lines: string[] = [
      '# Sync health report',
      `# Tenant,${csvEscape(tenantLabel.value)}`,
      `# dbName,${csvEscape(dbName.value)}`,
      `# Date range,${csvEscape(reportDateLabel.value)}`,
      `# Event filter,${csvEscape(historyKindFilter.value)}`,
      `# Level filter,${csvEscape(logLevelFilter.value)}`,
      `# Search,${csvEscape(search.value.trim() || '(none)')}`,
      `# Generated at,${csvEscape(generatedAt)}`,
      `# Counts,runs=${runs.length};events=${events.length};dlq=${dlq.length}`,
      '',
      '## Status',
      'field,value'
    ]

    if (tenantRow.value) {
      const row = tenantRow.value
      lines.push(
        `status,${csvEscape(row.status)}`,
        `mode,${csvEscape(row.lastSyncMode || '')}`,
        `synced,${csvEscape(row.lastSyncedCount ?? '')}`,
        `chunk,${csvEscape(
          typeof row.lastChunkIndex === 'number' && typeof row.lastChunkCount === 'number'
            ? `${row.lastChunkIndex}/${row.lastChunkCount}`
            : ''
        )}`,
        `lastSuccessAt,${csvEscape(row.lastSuccessAt || '')}`,
        `lastErrorAt,${csvEscape(row.lastErrorAt || '')}`,
        `lastError,${csvEscape(row.lastError || '')}`,
        `kafkaTopic,${csvEscape(row.kafkaTopic || '')}`
      )
    } else {
      lines.push('status,')
    }

    lines.push(
      '',
      '## Sync runs',
      'status,mode,syncId,startedAt,finishedAt,syncedCount,chunkIndex,chunkCount,eventCount,lastMessage'
    )
    for (const run of runs) {
      lines.push(
        [
          csvEscape(run.status),
          csvEscape(run.syncMode || ''),
          csvEscape(run.syncId || ''),
          csvEscape(run.startedAt || ''),
          csvEscape(run.finishedAt || ''),
          csvEscape(run.syncedCount ?? ''),
          csvEscape(run.chunkIndex ?? ''),
          csvEscape(run.chunkCount ?? ''),
          csvEscape(run.eventCount),
          csvEscape(run.lastMessage || '')
        ].join(',')
      )
    }

    lines.push(
      '',
      '## Events',
      'at,level,kind,eventType,contactType,email,externalId,contactName,syncId,chunkIndex,chunkCount,message'
    )
    for (const log of events) {
      lines.push(
        [
          csvEscape(log.at),
          csvEscape(log.level),
          csvEscape(log.kind),
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
      'at,eventType,kafkaTopic,partition,offset,error,rawPreview'
    )
    for (const row of dlq) {
      lines.push(
        [
          csvEscape(row.at),
          csvEscape(row.eventType || ''),
          csvEscape(row.kafkaTopic || ''),
          csvEscape(row.partition ?? ''),
          csvEscape(row.offset ?? ''),
          csvEscape(row.error),
          csvEscape(row.rawPreview || '')
        ].join(',')
      )
    }

    downloadTextFile(`sync-health-${dbName.value}-${stamp}.csv`, `${lines.join('\n')}\n`)
  } finally {
    reportPending.value = false
    reportFormatPending.value = null
  }
}

async function generatePdfReport() {
  const payload = buildReportPayload()
  if (!payload || !canGenerateReport.value) return
  reportPending.value = true
  reportFormatPending.value = 'pdf'
  try {
    const [{ jsPDF }, { autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable')
    ])
    const { generatedAt, stamp, runs, events, dlq } = payload
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
    doc.text('Sync health report', marginX, cursorY)
    cursorY += 18

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const meta = [
      `Tenant: ${tenantLabel.value}`,
      `Database: ${dbName.value}`,
      `Date range: ${reportDateLabel.value}`,
      `Event filter: ${historyKindFilter.value} · Level: ${logLevelFilter.value}`,
      `Search: ${search.value.trim() || '(none)'}`,
      `Generated: ${formatWhen(generatedAt)}`,
      `Counts: ${runs.length} runs · ${events.length} events · ${dlq.length} DLQ`
    ]
    for (const line of meta) {
      doc.text(line, marginX, cursorY)
      cursorY += 14
    }

    if (tenantRow.value) {
      const row = tenantRow.value
      autoTable(doc, {
        startY: cursorY + 6,
        head: [['Field', 'Value']],
        body: [
          ['Status', row.status],
          ['Mode', row.lastSyncMode || '—'],
          ['Synced', row.lastSyncedCount != null ? String(row.lastSyncedCount) : '—'],
          [
            'Chunk',
            typeof row.lastChunkIndex === 'number' && typeof row.lastChunkCount === 'number'
              ? `${row.lastChunkIndex}/${row.lastChunkCount}`
              : '—'
          ],
          ['Last success', formatWhen(row.lastSuccessAt)],
          ['Last error', row.lastError || formatWhen(row.lastErrorAt)],
          ['Topic', row.kafkaTopic || '—']
        ],
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [51, 65, 85] },
        margin: { left: marginX, right: marginX }
      })
      cursorY = lastTableY() + 16
    }

    ensureSpace()
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Sync runs', marginX, cursorY)
    autoTable(doc, {
      startY: cursorY + 8,
      head: [['Status', 'Mode', 'Started', 'Synced', 'Chunks', 'Events', 'Last message']],
      body:
        runs.length > 0
          ? runs.map((run) => [
              run.status,
              run.syncMode || '—',
              formatWhen(run.startedAt),
              run.syncedCount != null ? String(run.syncedCount) : '—',
              typeof run.chunkCount === 'number'
                ? `${typeof run.chunkIndex === 'number' ? `${run.chunkIndex}/` : ''}${run.chunkCount}`
                : '—',
              String(run.eventCount),
              (run.lastMessage || '—').slice(0, 80)
            ])
          : [['—', '—', '—', '—', '—', '—', 'No sync runs in range']],
      styles: { fontSize: 7, cellPadding: 3, overflow: 'linebreak' },
      headStyles: { fillColor: [51, 65, 85] },
      columnStyles: { 6: { cellWidth: 180 } },
      margin: { left: marginX, right: marginX }
    })
    cursorY = lastTableY() + 16

    ensureSpace()
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Events', marginX, cursorY)
    autoTable(doc, {
      startY: cursorY + 8,
      head: [['When', 'Level', 'Kind', 'Event', 'Email', 'Message']],
      body:
        events.length > 0
          ? events.map((log) => [
              formatWhen(log.at),
              log.level,
              log.kind,
              log.eventType || '—',
              log.email || '—',
              (log.message || '—').slice(0, 120)
            ])
          : [['—', '—', '—', '—', '—', 'No events in range']],
      styles: { fontSize: 7, cellPadding: 3, overflow: 'linebreak' },
      headStyles: { fillColor: [51, 65, 85] },
      columnStyles: { 5: { cellWidth: 220 } },
      margin: { left: marginX, right: marginX }
    })
    cursorY = lastTableY() + 16

    ensureSpace()
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Dead letter queue', marginX, cursorY)
    autoTable(doc, {
      startY: cursorY + 8,
      head: [['When', 'Event', 'Topic / offset', 'Error']],
      body:
        dlq.length > 0
          ? dlq.map((row) => [
              formatWhen(row.at),
              row.eventType || '—',
              `${row.kafkaTopic || '—'}${row.offset != null ? ` p${row.partition ?? '?'} @ ${row.offset}` : ''}`,
              (row.error || '—').slice(0, 140)
            ])
          : [['—', '—', '—', 'No dead-lettered messages in range']],
      styles: { fontSize: 7, cellPadding: 3, overflow: 'linebreak' },
      headStyles: { fillColor: [51, 65, 85] },
      columnStyles: { 3: { cellWidth: 260 } },
      margin: { left: marginX, right: marginX }
    })

    doc.save(`sync-health-${dbName.value}-${stamp}.pdf`)
  } finally {
    reportPending.value = false
    reportFormatPending.value = null
  }
}
</script>

<template>
  <section class="mx-auto w-full min-w-0 max-w-6xl space-y-5 sm:space-y-6">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0 space-y-2">
        <NuxtLink
          to="/admin/sync-health"
          class="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <span aria-hidden="true">←</span>
          Sync health
        </NuxtLink>
        <div class="flex flex-wrap items-center gap-2.5">
          <h1 class="page-title">{{ tenantLabel }}</h1>
          <span
            v-if="tenantRow"
            class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset"
            :class="statusBadgeClass(tenantRow.status)"
          >
            {{ tenantRow.status }}
          </span>
        </div>
        <p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
          <code class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[12px] text-slate-700">
            {{ dbName }}
          </code>
          <span v-if="history" class="text-slate-400">·</span>
          <span v-if="history">
            {{ history.runs.length }} run{{ history.runs.length === 1 ? '' : 's' }}
            · {{ history.logCount }} event{{ history.logCount === 1 ? '' : 's' }}
            · {{ tenantDlq.length }} DLQ
          </span>
        </p>
      </div>
      <div class="flex shrink-0 flex-col items-stretch gap-1.5 sm:items-end">
        <div class="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            class="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!tenantRow || actionPending || historyPending || boardPending"
            @click="() => void clearTenantHealth()"
          >
            Clear health
          </button>
          <button
            type="button"
            class="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            title="docs/marketing-sync-stuck-backlog-runbook.md"
            @click="showRunbookTips = !showRunbookTips"
          >
            Runbook
          </button>
          <div class="min-w-0">
            <p class="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Report date range
            </p>
            <TenantBrevoTrackingDateRangePicker
              v-model:preset="reportDatePreset"
              v-model:custom-from="reportCustomDateFrom"
              v-model:custom-to="reportCustomDateTo"
              :preset-options="SYNC_HEALTH_DATE_PRESET_OPTIONS"
              :label="reportDateLabel"
              default-preset="all"
            />
          </div>
          <div class="inline-flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <button
            type="button"
            class="inline-flex items-center gap-2 border-r border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!canGenerateReport"
            @click="generateCsvReport"
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
            {{ reportFormatPending === 'csv' ? 'CSV…' : 'CSV' }}
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!canGenerateReport"
            @click="() => void generatePdfReport()"
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
                d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z"
              />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M14 3v5h5" />
            </svg>
            {{ reportFormatPending === 'pdf' ? 'PDF…' : 'PDF' }}
          </button>
          </div>
          <TenantRefreshIconButton
            label="Refresh tenant history"
            :pending="historyPending || boardPending"
            @click="() => void refreshAll()"
          />
        </div>
        <p
          v-if="!reportDateRangeValid"
          class="text-xs font-medium text-rose-600"
          role="alert"
        >
          Start date must be on or before the end date.
        </p>
      </div>
    </header>

    <p v-if="historyPending && !history" class="text-sm text-slate-500">Loading tenant history…</p>

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
        <li>Replay or ack DLQ rows below after fixing the root cause.</li>
      </ul>
      <p class="mt-2 text-xs text-amber-800/80">
        Full write-up: <code>docs/marketing-sync-stuck-backlog-runbook.md</code>
      </p>
    </div>

    <template v-if="history">
      <div
        v-if="tenantRow && summaryFacts.length"
        class="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 sm:px-5"
      >
        <dl class="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="fact in summaryFacts"
            :key="fact.label"
            class="min-w-0"
          >
            <dt class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {{ fact.label }}
            </dt>
            <dd
              class="mt-1 truncate text-sm"
              :class="
                fact.tone === 'error'
                  ? 'font-medium text-rose-700'
                  : fact.tone === 'muted'
                    ? 'font-mono text-xs text-slate-500'
                    : 'text-slate-800'
              "
              :title="fact.value"
            >
              {{ fact.value }}
            </dd>
          </div>
        </dl>
      </div>

      <div class="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start">
        <section class="min-w-0 space-y-2.5">
          <div class="flex items-baseline justify-between gap-3">
            <h2 class="text-sm font-semibold text-slate-900">Sync runs</h2>
            <p class="text-xs text-slate-400">
              Updated {{ formatWhen(history.generatedAt) }}
            </p>
          </div>

          <div class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
            <div
              v-for="run in history.runs"
              :key="syncRunKey(run)"
              class="border-b border-slate-100 last:border-0"
            >
              <button
                type="button"
                class="flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50/90"
                @click="toggleSyncRun(syncRunKey(run))"
              >
                <span
                  class="mt-0.5 inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset"
                  :class="statusBadgeClass(run.status)"
                >
                  {{ run.status }}
                </span>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-slate-900">
                    {{ runTitle(run) }}
                  </p>
                  <p class="mt-0.5 text-xs leading-relaxed text-slate-500">
                    {{ formatWhen(run.startedAt) }}
                    <template v-if="run.finishedAt && run.finishedAt !== run.startedAt">
                      → {{ formatWhen(run.finishedAt) }}
                    </template>
                    <template v-if="typeof run.syncedCount === 'number'">
                      · {{ run.syncedCount }} contacts
                    </template>
                    <template v-if="typeof run.chunkCount === 'number'">
                      · {{ typeof run.chunkIndex === 'number' ? `${run.chunkIndex}/` : '' }}{{ run.chunkCount }} chunks
                    </template>
                    · {{ run.eventCount }} event{{ run.eventCount === 1 ? '' : 's' }}
                  </p>
                  <p
                    v-if="run.lastMessage && run.syncMode"
                    class="mt-1 truncate font-mono text-[11px] text-slate-600"
                    :title="run.lastMessage"
                  >
                    {{ run.lastMessage }}
                  </p>
                  <p
                    v-if="run.syncId"
                    class="mt-1 truncate font-mono text-[10px] text-slate-400"
                  >
                    {{ run.syncId }}
                  </p>
                </div>
                <span
                  class="mt-1 shrink-0 text-slate-400 transition"
                  :class="expandedSyncId === syncRunKey(run) ? 'rotate-90' : ''"
                  aria-hidden="true"
                >
                  ›
                </span>
              </button>

              <div
                v-if="expandedSyncId === syncRunKey(run)"
                class="space-y-2 border-t border-slate-100 bg-slate-50/80 px-4 py-3"
              >
                <div
                  v-for="event in run.events"
                  :key="event.id"
                  class="rounded-xl border border-slate-200/80 border-l-4 bg-white px-3 py-2.5"
                  :class="logAccentClass(event.level)"
                >
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-xs text-slate-500">{{ formatWhen(event.at) }}</span>
                    <span
                      class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset"
                      :class="logLevelClass(event.level)"
                    >
                      {{ event.level }}
                    </span>
                    <span class="text-[11px] text-slate-400">{{ event.kind }}</span>
                    <span
                      v-if="typeof event.chunkIndex === 'number' && typeof event.chunkCount === 'number'"
                      class="text-[11px] text-slate-400"
                    >
                      chunk {{ event.chunkIndex }}/{{ event.chunkCount }}
                    </span>
                  </div>
                  <p class="mt-1.5 whitespace-pre-wrap break-words text-sm text-slate-800">
                    {{ event.message }}
                  </p>
                </div>
              </div>
            </div>

            <p
              v-if="!historyPending && history.runs.length === 0"
              class="px-4 py-10 text-center text-sm text-slate-500"
            >
              No sync runs recorded yet.
            </p>
          </div>
        </section>

        <section class="min-w-0 space-y-2.5">
          <div class="flex items-baseline justify-between gap-3">
            <h2 class="text-sm font-semibold text-slate-900">Dead letter queue</h2>
            <p
              class="text-xs tabular-nums"
              :class="tenantDlq.length ? 'font-medium text-rose-600' : 'text-slate-400'"
            >
              {{ tenantDlq.length }}
            </p>
          </div>

          <div class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
            <div
              v-for="row in tenantDlq"
              :key="row.id"
              class="space-y-1.5 border-b border-slate-100 px-4 py-3 last:border-0"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-xs text-slate-500">{{ formatWhen(row.at) }}</span>
                  <span
                    v-if="row.eventType"
                    class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700"
                  >
                    {{ row.eventType }}
                  </span>
                </div>
                <div class="flex items-center gap-1.5">
                  <button
                    type="button"
                    class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                    :disabled="actionPending || !row.rawPreview"
                    @click="() => void replayDlqEntry(row.id)"
                  >
                    {{ dlqActionId === row.id && actionPending ? 'Replay…' : 'Replay' }}
                  </button>
                  <button
                    type="button"
                    class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
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
              <p
                v-if="row.rawPreview"
                class="truncate font-mono text-[10px] text-slate-400"
                :title="row.rawPreview"
              >
                {{ row.rawPreview }}
              </p>
            </div>

            <p
              v-if="tenantDlq.length === 0"
              class="px-4 py-10 text-center text-sm text-slate-500"
            >
              No dead-lettered messages.
            </p>
          </div>
        </section>
      </div>

      <section class="space-y-2.5">
        <div class="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 class="text-sm font-semibold text-slate-900">Event history</h2>
          <p class="text-xs text-slate-400">
            {{ filteredLogs.length }} shown
            <template v-if="filteredLogs.length !== history.logCount">
              of {{ history.logCount }}
            </template>
          </p>
        </div>

        <div class="rounded-2xl border border-slate-200/80 bg-white">
          <div class="space-y-3 border-b border-slate-100 px-4 py-3">
            <div class="flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <label class="block min-w-0 flex-1">
                <span class="sr-only">Search events</span>
                <input
                  v-model="search"
                  type="search"
                  placeholder="Search message, email, sync id…"
                  class="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-900 outline-none ring-slate-300 placeholder:text-slate-400 focus:bg-white focus:ring-2"
                >
              </label>
              <TenantBrevoTrackingDateRangePicker
                v-model:preset="datePreset"
                v-model:custom-from="customDateFrom"
                v-model:custom-to="customDateTo"
                :label="syncHealthDateLabel"
                :preset-options="SYNC_HEALTH_DATE_PRESET_OPTIONS"
                default-preset="all"
              />
            </div>
            <div
              class="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2"
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
              v-for="log in filteredLogs"
              :key="log.id"
              class="border-b border-l-4 border-slate-100 px-4 py-3 last:border-0"
              :class="logAccentClass(log.level)"
            >
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-xs tabular-nums text-slate-500">{{ formatWhen(log.at) }}</span>
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
                <span
                  v-if="log.eventType"
                  class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600"
                >
                  {{ log.eventType }}
                </span>
              </div>
              <p class="mt-1.5 whitespace-pre-wrap break-words text-sm text-slate-900">
                {{ log.message }}
              </p>
              <p
                v-if="log.email || log.externalId || log.syncId || (typeof log.chunkIndex === 'number' && typeof log.chunkCount === 'number')"
                class="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-slate-500"
              >
                <span v-if="log.email">{{ log.email }}</span>
                <span v-if="log.externalId">id {{ log.externalId }}</span>
                <span v-if="log.syncId" class="font-mono text-[11px]">sync {{ log.syncId }}</span>
                <span v-if="typeof log.chunkIndex === 'number' && typeof log.chunkCount === 'number'">
                  chunk {{ log.chunkIndex }}/{{ log.chunkCount }}
                </span>
              </p>
            </div>

            <p
              v-if="filteredLogs.length === 0"
              class="px-4 py-10 text-center text-sm text-slate-500"
            >
              {{
                history.logCount === 0
                  ? 'No events recorded for this tenant yet.'
                  : 'No events match this filter.'
              }}
            </p>
          </div>
        </div>
      </section>
    </template>
  </section>
</template>
