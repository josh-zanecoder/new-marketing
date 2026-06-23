/** Structured contact address aligned with `ContactAddress` in `contact.model.ts`. */
export type ContactAddressFields = {
  street?: string
  unit?: string
  city?: string
  state?: string
  zipCode?: string
  county?: string
}

/** CRM sync joins account street + unit into marketing `address.street`. */
export function joinContactStreetParts(street?: string, unit?: string): string {
  return [String(street ?? '').trim(), String(unit ?? '').trim()].filter(Boolean).join(' ')
}

/** Google Places often returns "El Paso County" — store as "El Paso" to match CRM/seed data. */
export function normalizeContactCounty(value?: string): string {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return ''
  return trimmed
    .replace(/,\s*(USA|United States)$/i, '')
    .replace(/\s+(County|Parish|Borough)$/i, '')
    .trim()
}

/** Display line for tables and summaries (street, city, state). */
export function formatContactAddress(addr?: ContactAddressFields | null): string {
  if (!addr) return ''
  return [joinContactStreetParts(addr.street, addr.unit), addr.city, addr.state, addr.zipCode, normalizeContactCounty(addr.county)]
    .filter(Boolean)
    .join(', ')
}
