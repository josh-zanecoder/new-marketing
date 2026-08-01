export type BrevoTrackingDatePresetId =
  | 'all'
  | 'today'
  | 'yesterday'
  | 'last7days'
  | 'last30days'
  | 'mtd'
  | 'lastMonth'
  | 'lastYear'
  | 'custom'

export interface BrevoTrackingDateRange {
  from: string | null
  to: string | null
}

/** Default for Tracking, campaign tracking, and Marketing Analytics. */
export const BREVO_TRACKING_DEFAULT_PRESET: BrevoTrackingDatePresetId = 'last7days'

/** Sidebar shortcuts — Brevo Logs / Statistics style. */
export const BREVO_TRACKING_DATE_PRESET_OPTIONS: {
  id: BrevoTrackingDatePresetId
  label: string
}[] = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last7days', label: 'Last 7 Days' },
  { id: 'last30days', label: 'Last 30 Days' },
  { id: 'mtd', label: 'This Month' },
  { id: 'lastMonth', label: 'Last Month' }
]

export function toYmdLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatSlashYmd(ymd: string): string {
  const [y, m, d] = ymd.split('-')
  if (!y || !m || !d) return ymd
  return `${m}/${d}/${y}`
}

export function presetToBrevoTrackingRange(
  preset: BrevoTrackingDatePresetId,
  now: Date = new Date()
): BrevoTrackingDateRange {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const ymdToday = toYmdLocal(today)

  if (preset === 'custom') return { from: null, to: null }
  if (preset === 'all') {
    const start = new Date(today)
    start.setDate(start.getDate() - 89)
    return { from: toYmdLocal(start), to: ymdToday }
  }
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

  if (preset === 'last30days') {
    const start = new Date(today)
    start.setDate(start.getDate() - 29)
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
  customTo: string,
  now: Date = new Date()
): string {
  const range =
    preset === 'custom'
      ? {
          from: customFrom.trim() || null,
          to: customTo.trim() || null
        }
      : presetToBrevoTrackingRange(preset, now)

  if (range.from && range.to) {
    return `${formatSlashYmd(range.from)} - ${formatSlashYmd(range.to)}`
  }
  if (range.from) return formatSlashYmd(range.from)
  if (range.to) return formatSlashYmd(range.to)

  return (
    BREVO_TRACKING_DATE_PRESET_OPTIONS.find((option) => option.id === preset)?.label ??
    'Last 7 Days'
  )
}

export function useBrevoTrackingDateRange() {
  const datePreset = ref<BrevoTrackingDatePresetId>(BREVO_TRACKING_DEFAULT_PRESET)
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

  /** True when the range differs from the default Last 7 Days. */
  const dateRangeFilterActive = computed(() => {
    if (datePreset.value === BREVO_TRACKING_DEFAULT_PRESET) return false
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
    datePreset.value = BREVO_TRACKING_DEFAULT_PRESET
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
