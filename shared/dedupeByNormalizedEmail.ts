/**
 * LO recipient-list feature-flag path: keep one row per email so duplicate
 * Marketing contacts (same address, different ids) do not appear twice.
 */

export function normalizeRecipientEmailKey(email: unknown): string {
  return String(email ?? '')
    .trim()
    .toLowerCase()
}

/**
 * Keep the first row for each non-empty email (case-insensitive).
 * Rows without a valid email are kept individually (keyed by `id` when present).
 */
export function dedupeByNormalizedEmailKeepFirst<T extends { email?: string; id?: string }>(
  rows: T[]
): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const row of rows) {
    const email = normalizeRecipientEmailKey(row.email)
    const key = email.includes('@')
      ? `e:${email}`
      : `id:${String(row.id ?? '').trim()}`
    if (key === 'id:') {
      out.push(row)
      continue
    }
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  return out
}
