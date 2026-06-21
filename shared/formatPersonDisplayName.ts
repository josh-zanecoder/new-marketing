/** Join first/last or fall back to a single display `name` (e.g. CRM handoff / forwarded headers). */
export function formatPersonDisplayName(parts: {
  firstName?: string | null
  lastName?: string | null
  name?: string | null
}): string {
  const full = [parts.firstName?.trim(), parts.lastName?.trim()].filter(Boolean).join(' ')
  if (full) return full
  return parts.name?.trim() ?? ''
}
