import type {
  RecipientFilterContactType,
  RecipientFilterProperty,
  RecipientFilterPropertyType
} from '@server/types/registry/recipientFilter.types'
import { LAST_RESORT_CONTACT_TYPE_KEY } from '@server/utils/contact/resolveDefaultContactTypeKey'
import { parseAudienceKey } from '@server/utils/recipient/recipientListAudience'

const PROPERTIES = new Set<RecipientFilterProperty>([
  'none',
  'address',
  'channel',
  'company',
  'contact_profile'
])

const PROPERTY_TYPES = new Set<RecipientFilterPropertyType>([
  'none',
  'state',
  'city',
  'county',
  'street',
  'profile_type',
  'profile_subtype'
])

const LEGACY_PROPERTY_TO_PAIR: Record<
  string,
  { property: RecipientFilterProperty; propertyType: RecipientFilterPropertyType }
> = {
  'address.state': { property: 'address', propertyType: 'state' },
  'address.city': { property: 'address', propertyType: 'city' },
  'address.county': { property: 'address', propertyType: 'county' },
  'address.street': { property: 'address', propertyType: 'street' }
}

/**
 * Normalizes registry / API `contactType` to a stable tenant key (same rules as list audience).
 * Invalid or empty input falls back to `LAST_RESORT_CONTACT_TYPE_KEY` when the shape is not parseable.
 */
export function normalizeRecipientFilterContactType(
  raw: unknown
): RecipientFilterContactType {
  return parseAudienceKey(raw) || LAST_RESORT_CONTACT_TYPE_KEY
}

export function normalizeRecipientFilterProperty(raw: unknown): RecipientFilterProperty {
  if (typeof raw === 'string' && LEGACY_PROPERTY_TO_PAIR[raw]) {
    return LEGACY_PROPERTY_TO_PAIR[raw].property
  }
  if (typeof raw === 'string' && PROPERTIES.has(raw as RecipientFilterProperty)) {
    return raw as RecipientFilterProperty
  }
  return 'none'
}

export function normalizeRecipientFilterPropertyType(
  raw: unknown
): RecipientFilterPropertyType {
  if (
    typeof raw === 'string' &&
    PROPERTY_TYPES.has(raw as RecipientFilterPropertyType)
  ) {
    return raw as RecipientFilterPropertyType
  }
  return 'none'
}

export function normalizeRecipientFilterPropertyFields(
  rawProperty: unknown,
  rawPropertyType: unknown
): { property: RecipientFilterProperty; propertyType: RecipientFilterPropertyType } {
  if (typeof rawProperty === 'string' && LEGACY_PROPERTY_TO_PAIR[rawProperty]) {
    return { ...LEGACY_PROPERTY_TO_PAIR[rawProperty] }
  }

  const property = normalizeRecipientFilterProperty(rawProperty)
  let propertyType = normalizeRecipientFilterPropertyType(rawPropertyType)

  if (property === 'address') {
    if (propertyType === 'none') propertyType = 'state'
  } else if (property === 'contact_profile') {
    if (propertyType !== 'profile_type' && propertyType !== 'profile_subtype') {
      propertyType = 'profile_type'
    }
  } else {
    propertyType = 'none'
  }

  return { property, propertyType }
}

export function canonicalRecipientFilterFieldsFromDoc(doc: {
  property?: string
  propertyType?: string | null
}): { property: RecipientFilterProperty; propertyType: RecipientFilterPropertyType } {
  const p = doc.property
  if (typeof p === 'string' && LEGACY_PROPERTY_TO_PAIR[p]) {
    return { ...LEGACY_PROPERTY_TO_PAIR[p] }
  }
  const property = normalizeRecipientFilterProperty(p)
  let propertyType = normalizeRecipientFilterPropertyType(doc.propertyType)
  if (property === 'address') {
    if (propertyType === 'none') propertyType = 'state'
  } else if (property === 'contact_profile') {
    if (propertyType !== 'profile_type' && propertyType !== 'profile_subtype') {
      propertyType = 'profile_type'
    }
  } else {
    propertyType = 'none'
  }
  return { property, propertyType }
}

export function normalizeRecipientFilterPropertyValue(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw.trim().slice(0, 2000)
}
