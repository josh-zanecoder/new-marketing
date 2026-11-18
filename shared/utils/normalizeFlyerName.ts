/** Normalize a flyer display name for storage. */
export function normalizeFlyerName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}
