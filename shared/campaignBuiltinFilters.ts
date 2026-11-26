/**
 * Contact fields offered by Advanced Recipient Filtering without any admin setup.
 *
 * The CRM list builder only offers fields an admin registered per tenant. Marketing campaigns can
 * filter on every standard contact field, so these are exposed as virtual registry filters with a
 * `builtin:` id. They resolve to the same criteria as registry filters (see `registryDocToCriteria`),
 * so preview, saved audience and the live membership sync all share one code path.
 */
export const BUILTIN_FILTER_PREFIX = 'builtin:'

export interface BuiltinFilterDef {
  key: string
  name: string
  property: string
  propertyType: string
  /** Pick from the values contacts already hold; false = free text. */
  valuesFromContacts: boolean
}

export const BUILTIN_FILTERS: readonly BuiltinFilterDef[] = [
  { key: 'state', name: 'State', property: 'address', propertyType: 'state', valuesFromContacts: true },
  { key: 'city', name: 'City', property: 'address', propertyType: 'city', valuesFromContacts: true },
  { key: 'zip', name: 'ZIP code', property: 'address', propertyType: 'zip', valuesFromContacts: true },
  { key: 'county', name: 'County', property: 'address', propertyType: 'county', valuesFromContacts: true },
  { key: 'street', name: 'Street address', property: 'address', propertyType: 'street', valuesFromContacts: false },
  { key: 'company', name: 'Company', property: 'company', propertyType: 'none', valuesFromContacts: true },
  { key: 'channel', name: 'Channel', property: 'channel', propertyType: 'none', valuesFromContacts: true },
  { key: 'stage', name: 'Stage', property: 'stage', propertyType: 'none', valuesFromContacts: true },
  { key: 'source', name: 'Source', property: 'source', propertyType: 'none', valuesFromContacts: true },
  { key: 'priority', name: 'Priority', property: 'priority', propertyType: 'none', valuesFromContacts: true },
  { key: 'broker_role', name: 'Broker role', property: 'broker_role', propertyType: 'none', valuesFromContacts: true }
]

export function isBuiltinFilterId(id: unknown): boolean {
  return typeof id === 'string' && id.startsWith(BUILTIN_FILTER_PREFIX)
}

export interface BuiltinFilterDoc {
  _id: string
  name: string
  contactType: string
  property: string
  propertyType: string
  propertyValue: string
  valuesFromContacts: boolean
  enabled: true
}

/** Registry-shaped document for a built-in filter, scoped to one contact type; null when unknown. */
export function builtinFilterDoc(id: unknown, contactType: string): BuiltinFilterDoc | null {
  if (!isBuiltinFilterId(id)) return null
  const key = String(id).slice(BUILTIN_FILTER_PREFIX.length)
  const def = BUILTIN_FILTERS.find((f) => f.key === key)
  if (!def) return null
  return {
    _id: `${BUILTIN_FILTER_PREFIX}${def.key}`,
    name: def.name,
    contactType,
    property: def.property,
    propertyType: def.propertyType,
    propertyValue: '',
    valuesFromContacts: def.valuesFromContacts,
    enabled: true
  }
}
