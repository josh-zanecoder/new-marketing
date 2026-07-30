import { formatRegistryLabelForDisplay } from '~/utils/registryLabelDisplay'
import { recipientFilterValueIsRegistryKey } from '~~/shared/utils/recipientFilterPropertyValue'
import {
  recipientFilterAddressPropertyTypeOptions,
  recipientFilterContactProfilePropertyTypeOptions,
  recipientFilterPropertyFieldOptions,
  recipientFilterRelationshipPartnerPropertyTypeOptions,
  recipientFilterPropertyHasTypeField,
  type RecipientFilterPropertyFieldValue
} from '~/utils/recipientFilterOptions'

function normalized(raw: string): string {
  return String(raw ?? '').trim().toLowerCase()
}

function labelFromOptions(
  options: readonly { value: string; label: string }[],
  value: string,
  fallback?: string
): string {
  const opt = options.find((o) => o.value === value)
  return opt?.label ?? formatRegistryLabelForDisplay(fallback ?? value)
}

export function recipientFilterPropertyLabel(raw: string): string {
  const key = normalized(raw)
  if (key === 'relationship_partner') return 'Partner'
  return formatRegistryLabelForDisplay(raw)
}

export function recipientFilterPropertyTypeLabel(raw: string): string {
  const key = normalized(raw)
  if (key === 'partner_email') return 'Partner email'
  if (key === 'partner_external_id') return 'Partner external ID'
  if (key === 'partner_owner_email') return 'Partner owner email'
  if (key === 'partner_type') return 'Partner type'
  if (key === 'partner_name') return 'Partner name'
  return formatRegistryLabelForDisplay(raw)
}

export function recipientCriterionPropertyLabel(raw: string): string {
  const key = normalized(raw)
  if (key === 'related_partner_email') return 'Partner email'
  if (key === 'related_partner_external_id') return 'Partner external ID'
  if (key === 'related_partner_owner_email') return 'Partner owner email'
  if (key === 'related_partner_type') return 'Partner type'
  if (key === 'related_partner_name') return 'Partner name'
  if (key === 'relationship_partner') return 'Partner'
  return formatRegistryLabelForDisplay(raw)
}

/**
 * Saved property value as shown to users. Registry slugs read better with spaces, but literal
 * contact data (company names, emails, streets) has to keep its own punctuation.
 */
export function recipientFilterValueDisplay(
  raw: string,
  property: string,
  propertyType?: string | null
): string {
  if (recipientFilterValueIsRegistryKey(property, propertyType)) {
    return formatRegistryLabelForDisplay(raw)
  }
  return String(raw ?? '').trim()
}

export function propertyFieldLabel(value: string): string {
  return labelFromOptions(recipientFilterPropertyFieldOptions, value)
}

export function addressPropertyTypeLabel(value: string): string {
  return labelFromOptions(recipientFilterAddressPropertyTypeOptions, value)
}

export function contactProfilePropertyTypeLabel(value: string): string {
  return labelFromOptions(recipientFilterContactProfilePropertyTypeOptions, value)
}

export function relationshipPartnerPropertyTypeLabel(value: string): string {
  return labelFromOptions(recipientFilterRelationshipPartnerPropertyTypeOptions, value)
}

export function recipientFilterTypeLabel(filter: {
  property: string
  propertyType: string
}): string {
  if (!recipientFilterPropertyHasTypeField(filter.property)) return '—'
  if (filter.property === 'address') {
    return addressPropertyTypeLabel(filter.propertyType || 'state')
  }
  if (filter.property === 'contact_profile') {
    return contactProfilePropertyTypeLabel(filter.propertyType || 'profile_type')
  }
  return relationshipPartnerPropertyTypeLabel(filter.propertyType || 'partner_email')
}

export function recipientFilterPropertyTypeForSave(
  property: RecipientFilterPropertyFieldValue,
  propertyType: string
): string {
  return recipientFilterPropertyHasTypeField(property) ? propertyType : 'none'
}
