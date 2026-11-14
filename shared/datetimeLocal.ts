/** Format a Date for `<input type="datetime-local">` (local timezone, minutes precision). */
export function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Default schedule picker value: ~65 minutes from `fromMs` (API requires ≥1 minute ahead). */
export function defaultScheduleDatetimeLocal(fromMs = Date.now()): string {
  return toDatetimeLocalValue(new Date(fromMs + 65 * 60 * 1000))
}

/**
 * Initial schedule picker value: the campaign's saved `scheduledAt` when present,
 * otherwise the default lead time. Never replace a saved schedule with the default.
 */
export function initialScheduleDatetimeLocal(
  scheduledAt: string | Date | null | undefined,
  fromMs = Date.now()
): string {
  const raw = scheduledAt instanceof Date ? scheduledAt : String(scheduledAt ?? '').trim()
  if (raw) {
    const saved = raw instanceof Date ? raw : new Date(raw)
    if (!Number.isNaN(saved.getTime())) return toDatetimeLocalValue(saved)
  }
  return defaultScheduleDatetimeLocal(fromMs)
}

/** Parse a datetime-local string to ISO, or null if invalid. */
export function parseDatetimeLocalToIso(local: string): string | null {
  const parsed = new Date(String(local ?? '').trim())
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}
