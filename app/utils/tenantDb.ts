/** Derives tenant DB name from display name. Matches server-side toTenantDbName. */
export function toTenantDbName(displayName: string): string {
  const base = displayName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (!base) return ''
  const truncated = base.slice(0, 61)
  return `${truncated}_db`
}
