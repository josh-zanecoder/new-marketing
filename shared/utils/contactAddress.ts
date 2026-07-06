/** Structured contact address aligned with `ContactAddress` in `contact.model.ts`. */
export type ContactAddressFields = {
  street?: string
  unit?: string
  city?: string
  state?: string
  county?: string
}

/** CRM sync joins account street + unit into marketing `address.street`. */
export function joinContactStreetParts(street?: string, unit?: string): string {
  return [String(street ?? '').trim(), String(unit ?? '').trim()].filter(Boolean).join(' ')
}

export function normalizeContactAddressInput(
  input?: ContactAddressFields | null
): Required<ContactAddressFields> {
  return {
    street: String(input?.street ?? '').trim(),
    unit: String(input?.unit ?? '').trim(),
    city: String(input?.city ?? '').trim(),
    state: String(input?.state ?? '').trim(),
    county: normalizeContactCounty(String(input?.county ?? ''))
  }
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
  const streetLine = joinContactStreetParts(addr.street, addr.unit)
  return [streetLine, addr.city, addr.state, normalizeContactCounty(addr.county)].filter(Boolean).join(', ')
}
