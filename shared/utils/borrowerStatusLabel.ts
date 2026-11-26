/**
 * Retail origination sends a borrower's status to Marketing as a slug (`active_borrower`).
 * The slug is derived from the tenant's own label, so spacing + capitalising each word
 * gives the label people configured (`Active Borrower`) without a second lookup.
 */
export function borrowerStatusLabel(raw: unknown): string {
  const slug = typeof raw === 'string' ? raw.trim() : ''
  if (!slug) return ''
  return slug
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

/** Trimmed, lowercased, de-duplicated status slugs from request input (array or comma list). */
export function normalizeAudienceStatuses(raw: unknown, max = 50): string[] {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(',')
      : []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of list) {
    const value = typeof item === 'string' ? item.trim().toLowerCase() : ''
    if (!value || value.length > 120 || seen.has(value)) continue
    seen.add(value)
    out.push(value)
    if (out.length >= max) break
  }
  return out
}
