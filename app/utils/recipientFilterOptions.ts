/** Recipient filter property fields (admin tenant detail form). */
export const recipientFilterPropertyFieldOptions = [
  { value: 'none', label: 'None' },
  { value: 'address', label: 'Address' },
  { value: 'channel', label: 'Channel' },
  { value: 'company', label: 'Company' },
  { value: 'status', label: 'Status' },
  { value: 'stage', label: 'Stage' },
  { value: 'contact_profile', label: 'Contact profile' },
  { value: 'relationship_partner', label: 'Relationship partner' }
] as const

export const recipientFilterAddressPropertyTypeOptions = [
  { value: 'state', label: 'State' },
  { value: 'city', label: 'City' },
  { value: 'county', label: 'County' },
  { value: 'street', label: 'Street' }
] as const

export const recipientFilterContactProfilePropertyTypeOptions = [
  { value: 'profile_type', label: 'Type' },
  { value: 'profile_subtype', label: 'Sub Type' }
] as const

export const recipientFilterRelationshipPartnerPropertyTypeOptions = [
  { value: 'partner_email', label: 'Partner email' },
  { value: 'partner_external_id', label: 'Partner external ID' },
  { value: 'partner_owner_email', label: 'Partner owner email' },
  { value: 'partner_name', label: 'Partner name' }
] as const

export type RecipientFilterPropertyFieldValue =
  (typeof recipientFilterPropertyFieldOptions)[number]['value']

export type RecipientFilterAddressPropertyTypeValue =
  (typeof recipientFilterAddressPropertyTypeOptions)[number]['value']

export type RecipientFilterContactProfilePropertyTypeValue =
  (typeof recipientFilterContactProfilePropertyTypeOptions)[number]['value']

export type RecipientFilterRelationshipPartnerPropertyTypeValue =
  (typeof recipientFilterRelationshipPartnerPropertyTypeOptions)[number]['value']

export type RecipientFilterPropertyTypeValue =
  | RecipientFilterAddressPropertyTypeValue
  | RecipientFilterContactProfilePropertyTypeValue
  | RecipientFilterRelationshipPartnerPropertyTypeValue

const propertyTypeConfig = {
  address: {
    options: recipientFilterAddressPropertyTypeOptions,
    default: 'state' as RecipientFilterAddressPropertyTypeValue
  },
  contact_profile: {
    options: recipientFilterContactProfilePropertyTypeOptions,
    default: 'profile_type' as RecipientFilterContactProfilePropertyTypeValue
  },
  relationship_partner: {
    options: recipientFilterRelationshipPartnerPropertyTypeOptions,
    default: 'partner_email' as RecipientFilterRelationshipPartnerPropertyTypeValue
  }
} as const

export function recipientFilterPropertyHasTypeField(property: string): property is keyof typeof propertyTypeConfig {
  return property in propertyTypeConfig
}

export function resolveRecipientFilterPropertyType(
  property: RecipientFilterPropertyFieldValue,
  savedType: string
): RecipientFilterPropertyTypeValue {
  if (!recipientFilterPropertyHasTypeField(property)) {
    return 'state'
  }
  const { options, default: fallback } = propertyTypeConfig[property]
  return (options as readonly { value: string }[]).some((o) => o.value === savedType)
    ? (savedType as RecipientFilterPropertyTypeValue)
    : fallback
}

export function resolveRecipientFilterPropertyField(savedProperty: string): RecipientFilterPropertyFieldValue {
  return (recipientFilterPropertyFieldOptions as readonly { value: string }[]).some(
    (o) => o.value === savedProperty
  )
    ? (savedProperty as RecipientFilterPropertyFieldValue)
    : 'none'
}
