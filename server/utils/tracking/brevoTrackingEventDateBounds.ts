/**
 * Loose UTC bounds for Mongo `eventAt` pre-filter.
 * Pads ±1 day so client-TZ day edges are not dropped; exact local-day filter still runs in-app.
 */
export function parseYmdToUtcBounds(
  fromYmd: string | null,
  toYmd: string | null,
  _tzOffsetMinutes?: number | null
): { start: Date; end: Date } | null {
  if (!fromYmd && !toYmd) return null

  const parse = (ymd: string): Date | null => {
    const [y, m, d] = ymd.split('-').map(Number)
    if (!y || !m || !d) return null
    return new Date(Date.UTC(y, m - 1, d))
  }

  const from = fromYmd ? parse(fromYmd) : null
  const to = toYmd ? parse(toYmd) : null
  if (!from && !to) return null

  const start = from ? new Date(from) : new Date(to!)
  start.setUTCDate(start.getUTCDate() - 1)

  const end = to ? new Date(to) : new Date(from!)
  end.setUTCDate(end.getUTCDate() + 2)
  end.setUTCMilliseconds(end.getUTCMilliseconds() - 1)

  return { start, end }
}

/**
 * Exact UTC bounds for a client-local YMD range.
 * `tzOffsetMinutes` is `Date#getTimezoneOffset()` from the browser
 * (minutes to add to local time to get UTC).
 */
export function parseYmdToExactUtcBounds(
  fromYmd: string | null,
  toYmd: string | null,
  tzOffsetMinutes?: number | null
): { start: Date; end: Date } | null {
  if (!fromYmd && !toYmd) return null

  const offset =
    typeof tzOffsetMinutes === 'number' && Number.isFinite(tzOffsetMinutes)
      ? tzOffsetMinutes
      : 0

  const localMidnightUtc = (ymd: string): Date | null => {
    const [y, m, d] = ymd.split('-').map(Number)
    if (!y || !m || !d) return null
    return new Date(Date.UTC(y, m - 1, d) + offset * 60_000)
  }

  const fromStart = fromYmd ? localMidnightUtc(fromYmd) : null
  const toStart = toYmd ? localMidnightUtc(toYmd) : null
  if (!fromStart && !toStart) return null

  const start = fromStart ?? toStart!

  const endDayYmd = toYmd ?? fromYmd!
  const [y, m, d] = endDayYmd.split('-').map(Number)
  if (!y || !m || !d) return null
  const endExclusive = new Date(Date.UTC(y, m - 1, d + 1) + offset * 60_000)
  const end = new Date(endExclusive.getTime() - 1)

  return { start, end }
}
