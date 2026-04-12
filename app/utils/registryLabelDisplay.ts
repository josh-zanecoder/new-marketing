/** Human-readable labels for registry keys (e.g. `contact_profile` → `contact profile`). */
export function formatRegistryLabelForDisplay(raw: string): string {
  const s = String(raw ?? '').trim()
  if (s === 'profile_type') return 'Type'
  if (s === 'profile_subtype') return 'Sub Type'
  return s.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
}
