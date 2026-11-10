/**
 * Round-robin a slice of tenant db names so each reconcile tick stays short
 * and does not walk every client while holding the Mongo pool.
 */
export function takeReconcileTenantDbNameBatch(
  dbNames: string[],
  batchSize: number,
  cursor: { index: number }
): string[] {
  const names = dbNames.map((n) => String(n || '').trim()).filter(Boolean)
  if (!names.length) return []

  const size = Math.max(1, Math.floor(batchSize))
  const start =
    Number.isFinite(cursor.index) && cursor.index >= 0
      ? Math.floor(cursor.index) % names.length
      : 0

  const out: string[] = []
  const take = Math.min(size, names.length)
  for (let i = 0; i < take; i++) {
    const name = names[(start + i) % names.length]
    if (name) out.push(name)
  }
  cursor.index = (start + out.length) % names.length
  return out
}
