export type BrevoTrackingDatePresetId =
  | 'all'
  | 'today'
  | 'yesterday'
  | 'last7days'
  | 'mtd'
  | 'lastMonth'
  | 'lastYear'
  | 'custom'

export interface BrevoTrackingDateRange {
  from: string | null
  to: string | null
}

export const BREVO_TRACKING_DATE_PRESET_OPTIONS: {
  id: BrevoTrackingDatePresetId
  label: string
}[] = [
  { id: 'all', label: 'Last 90 days' },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last7days', label: 'Last 7 days' },
  { id: 'mtd', label: 'Month to date' },
  { id: 'lastMonth', label: 'Last month' },
  { id: 'lastYear', label: 'Last year' },
  { id: 'custom', label: 'Custom range' }
]

export function toYmdLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function presetToBrevoTrackingRange(
  preset: BrevoTrackingDatePresetId,
  now: Date = new Date()
): BrevoTrackingDateRange {
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

  if (preset === 'last7days') {
    const start = new Date(today)
    start.setDate(start.getDate() - 6)
    return { from: toYmdLocal(start), to: ymdToday }
  }

  if (preset === 'mtd') {
    const first = new Date(now.getFullYear(), now.getMonth(), 1)
    return { from: toYmdLocal(first), to: ymdToday }
  }

  if (preset === 'lastMonth') {
    const firstThis = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastPrev = new Date(firstThis.getTime() - 1)
    const firstPrev = new Date(lastPrev.getFullYear(), lastPrev.getMonth(), 1)
    return { from: toYmdLocal(firstPrev), to: toYmdLocal(lastPrev) }
  }

  if (preset === 'lastYear') {
    const year = now.getFullYear() - 1
    const first = new Date(year, 0, 1)
    const last = new Date(year, 11, 31)
    return { from: toYmdLocal(first), to: toYmdLocal(last) }
  }

  return { from: null, to: null }
}

export function localDayStartMs(iso: string): number {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return NaN
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

export function inputYmdToStartMs(ymd: string): number | null {
  if (!ymd.trim()) return null
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d).getTime()
}

export function isoMatchesBrevoTrackingRange(
  iso: string | undefined,
  range: BrevoTrackingDateRange
): boolean {
  if (!iso?.trim()) return !range.from && !range.to
  const day = localDayStartMs(iso)
  if (Number.isNaN(day)) return true
  if (!range.from && !range.to) return true
  const fromMs = range.from ? inputYmdToStartMs(range.from) : null
  const toMs = range.to ? inputYmdToStartMs(range.to) : null
  if (fromMs != null && day < fromMs) return false
  if (toMs != null && day > toMs) return false
  return true
}

export function formatYmdDisplay(ymd: string): string {
  const ms = inputYmdToStartMs(ymd)
  if (ms == null) return ymd
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

export function ymdToLocalDate(ymd: string): Date | null {
  const ms = inputYmdToStartMs(ymd)
  if (ms == null) return null
  return new Date(ms)
}

export function datesToYmdRange(dates: [Date, Date] | null): BrevoTrackingDateRange {
  if (!dates?.[0] || !dates[1]) return { from: null, to: null }
  return {
    from: toYmdLocal(dates[0]),
    to: toYmdLocal(dates[1])
  }
}

export function ymdRangeToDates(from: string, to: string): [Date, Date] | null {
  const start = ymdToLocalDate(from)
  const end = ymdToLocalDate(to)
  if (!start || !end) return null
  return [start, end]
}

export function formatBrevoTrackingDateRangeLabel(
  preset: BrevoTrackingDatePresetId,
  customFrom: string,
  customTo: string
): string {
  if (preset !== 'custom') {
    return (
      BREVO_TRACKING_DATE_PRESET_OPTIONS.find((option) => option.id === preset)?.label ??
      'Last 90 days'
    )
  }

  const from = customFrom.trim()
  const to = customTo.trim()
  if (!from && !to) return 'Custom range'
  if (from && to) return `${formatYmdDisplay(from)} – ${formatYmdDisplay(to)}`
  if (from) return `From ${formatYmdDisplay(from)}`
  return `Until ${formatYmdDisplay(to)}`
}

export function useBrevoTrackingDateRange() {
  const datePreset = ref<BrevoTrackingDatePresetId>('all')
  const customDateFrom = ref('')
  const customDateTo = ref('')

  const effectiveDateRange = computed((): BrevoTrackingDateRange => {
    if (datePreset.value === 'custom') {
      return {
        from: customDateFrom.value.trim() || null,
        to: customDateTo.value.trim() || null
      }
    }
    return presetToBrevoTrackingRange(datePreset.value, new Date())
  })

  const dateRangeFilterActive = computed(() => {
    if (datePreset.value === 'all') return false
    if (datePreset.value === 'custom') {
      return !!(customDateFrom.value.trim() || customDateTo.value.trim())
    }
    return true
  })

  const dateRangeLabel = computed(() =>
    formatBrevoTrackingDateRangeLabel(
      datePreset.value,
      customDateFrom.value,
      customDateTo.value
    )
  )

  function resetDateRange() {
    datePreset.value = 'all'
    customDateFrom.value = ''
    customDateTo.value = ''
  }

  return {
    datePreset,
    customDateFrom,
    customDateTo,
    effectiveDateRange,
    dateRangeFilterActive,
    dateRangeLabel,
    resetDateRange
  }
}
