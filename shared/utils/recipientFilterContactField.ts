/**
 * Contact field a recipient filter reads its selectable values from when the filter is set to
 * `valuesFromContacts`, instead of the value an admin typed into `propertyValue`.
 *
 * Only plain scalar fields are listed: their distinct values make a usable dropdown. Free-text and
 * multi-key fields (street, email, profile keys, partner links) are left out.
 */

function canonicalKey(raw: string | null | undefined): string {
  return String(raw ?? '').trim().toLowerCase()
}

export function recipientFilterContactFieldPath(
  property: string | null | undefined,
  propertyType?: string | null
): string | null {
  const prop = canonicalKey(property)
  const type = canonicalKey(propertyType)

  /** Legacy docs store the pair as `address.state`; current ones split property/propertyType. */
  if (prop === 'address.state') return 'address.state'
  if (prop === 'address.city') return 'address.city'
  if (prop === 'address.county') return 'address.county'
  if (prop === 'address') {
    if (type === 'city') return 'address.city'
    if (type === 'county') return 'address.county'
    if (type === 'street') return null
    return 'address.state'
  }

  if (prop === 'company') return 'company'
  if (prop === 'channel') return 'channel'
  if (prop === 'status') return 'status'
  if (prop === 'stage') return 'stage'
  if (prop === 'source') return 'source'
  return null
}

export function recipientFilterSupportsContactValues(
  property: string | null | undefined,
  propertyType?: string | null
): boolean {
  return recipientFilterContactFieldPath(property, propertyType) !== null
}
