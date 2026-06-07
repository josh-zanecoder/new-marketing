/** Extract a user-facing message from $fetch / API errors. */
export function fetchErrorMessage(e: unknown, fallback: string): string {
  if (e && typeof e === 'object' && 'data' in e) {
    const msg = (e as { data?: { message?: string } }).data?.message
    if (typeof msg === 'string' && msg) return msg
  }
  if (e instanceof Error && e.message) return e.message
  return fallback
}
