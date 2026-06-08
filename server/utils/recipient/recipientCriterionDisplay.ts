import { canonicalRecipientFilterFieldsFromDoc } from '@server/utils/recipient/recipientFilterValidation'

/** Map a registry filter doc + list override value to a display criterion chip. */
export function criterionDisplayFromRegistryFilter(
  filterDoc: Record<string, unknown>,
  listPropertyValue: string
): { property: string; value: string } {
  const { property, propertyType } = canonicalRecipientFilterFieldsFromDoc(filterDoc)
  const registryVal =
    typeof filterDoc.propertyValue === 'string' ? filterDoc.propertyValue.trim() : ''
  const value = (listPropertyValue || registryVal).trim()
  let prop = String(property || 'unknown').trim() || 'unknown'

  if (property === 'address') {
    if (propertyType === 'state') prop = 'state'
    else if (propertyType === 'city') prop = 'city'
    else if (propertyType === 'county') prop = 'county'
    else if (propertyType === 'street') prop = 'street'
  }
  if (property === 'contact_profile') {
    if (propertyType === 'profile_type') prop = 'profile_type'
    else if (propertyType === 'profile_subtype') prop = 'profile_subtype'
    else prop = 'profile_type'
  }
  if (property === 'relationship_partner') {
    if (propertyType === 'partner_email') prop = 'related_partner_email'
    else if (propertyType === 'partner_external_id') prop = 'related_partner_external_id'
    else if (propertyType === 'partner_type') prop = 'related_partner_type'
    else if (propertyType === 'partner_owner_email') prop = 'related_partner_owner_email'
    else if (propertyType === 'partner_name') prop = 'related_partner_name'
    else prop = 'related_partner_email'
  }

  return { property: prop, value }
}
