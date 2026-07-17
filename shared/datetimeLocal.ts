/** Format a Date for `<input type="datetime-local">` (local timezone, minutes precision). */
export function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Default schedule picker value: ~65 minutes from `fromMs` (API requires ≥1 minute ahead). */
export function defaultScheduleDatetimeLocal(fromMs = Date.now()): string {
  return toDatetimeLocalValue(new Date(fromMs + 65 * 60 * 1000))
}

/** Parse a datetime-local string to ISO, or null if invalid. */
export function parseDatetimeLocalToIso(local: string): string | null {
  const parsed = new Date(String(local ?? '').trim())
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}
