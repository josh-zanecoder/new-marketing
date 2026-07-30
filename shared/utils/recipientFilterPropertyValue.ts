/**
 * Splitting rules for a recipient filter's saved property value.
 *
 * Only properties matched against multi-key contact fields (state, source, profile keys, partner
 * links) hold a list. The rest match one literal contact value, so punctuation belongs to the value
 * itself — `NEXA Mortgage, LLC _ BP` is one company, not `NEXA Mortgage` plus `LLC _ BP`.
 */

const VALUE_LIST_SEPARATORS = /[\n,;]+/

function canonicalKey(raw: string | null | undefined): string {
  return String(raw ?? '').trim().toLowerCase()
}

export function recipientFilterPropertyAcceptsValueList(
  property: string | null | undefined,
  propertyType?: string | null
): boolean {
  const prop = canonicalKey(property)
  const type = canonicalKey(propertyType)

  /** Legacy docs store the pair as `address.state`; current ones split property/propertyType. */
  if (prop === 'address.state') return true
  if (prop.startsWith('address.')) return false
  if (prop === 'address') return type !== 'city' && type !== 'county' && type !== 'street'

  return prop === 'source' || prop === 'contact_profile' || prop === 'relationship_partner'
}

export function splitRecipientFilterValueList(raw: unknown): string[] {
  if (typeof raw !== 'string') return []
  return raw
    .split(VALUE_LIST_SEPARATORS)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Selectable values behind one saved filter: a split list, or a single whole literal value. */
export function recipientFilterPropertyValueTokens(
  raw: unknown,
  property: string | null | undefined,
  propertyType?: string | null
): string[] {
  if (recipientFilterPropertyAcceptsValueList(property, propertyType)) {
    return splitRecipientFilterValueList(raw)
  }
  const single = typeof raw === 'string' ? raw.trim() : ''
  return single ? [single] : []
}

/**
 * Whether a value is a registry slug (safe to render underscores as spaces) or literal contact data
 * that must be shown verbatim. Accepts both filter properties and criterion properties.
 */
export function recipientFilterValueIsRegistryKey(
  property: string | null | undefined,
  propertyType?: string | null
): boolean {
  const prop = canonicalKey(property)
  if (prop === 'contact_profile') return true
  if (prop === 'relationship_partner') return canonicalKey(propertyType) === 'partner_type'
  return prop === 'profile_type' || prop === 'profile_subtype' || prop === 'related_partner_type'
}
