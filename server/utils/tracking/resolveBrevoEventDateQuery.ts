const BREVO_MAX_RANGE_DAYS = 90

function toYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseYmd(ymd: string): Date | null {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function clampRange(start: Date, end: Date): { startDate: string; endDate: string } {
  const endYmd = toYmd(end)
  let startDate = toYmd(start)
  const maxStart = new Date(end)
  maxStart.setDate(maxStart.getDate() - (BREVO_MAX_RANGE_DAYS - 1))
  if (start.getTime() < maxStart.getTime()) {
    startDate = toYmd(maxStart)
  }
  return { startDate, endDate: endYmd }
}

/**
 * Maps UI / API `from`+`to` (YYYY-MM-DD) to Brevo getEmailEventReport params.
 * When both are omitted, Brevo defaults to the last 30 days.
 */
export function resolveBrevoEventDateQuery(fromYmd: string | null, toYmdStr: string | null): {
  startDate?: string
  endDate?: string
  days?: number
} {
  if (fromYmd && toYmdStr) {
    const from = parseYmd(fromYmd)
    const to = parseYmd(toYmdStr)
    if (from && to) {
      const ordered =
        from.getTime() <= to.getTime()
          ? clampRange(from, to)
          : clampRange(to, from)
      return ordered
    }
  }

  if (fromYmd && !toYmdStr) {
    const from = parseYmd(fromYmd)
    if (from) {
      const end = new Date()
      return clampRange(from, end)
    }
  }

  if (!fromYmd && toYmdStr) {
    const to = parseYmd(toYmdStr)
    if (to) {
      const start = new Date(to)
      start.setDate(start.getDate() - 29)
      return clampRange(start, to)
    }
  }

  // Brevo default window when no dates are passed
  return { days: 30 }
}
