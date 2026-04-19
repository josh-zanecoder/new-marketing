import type { Types } from 'mongoose'

/** Tenant `contact_types` key (normalized lowercase in APIs; see `parseAudienceKey`). */
export type RecipientFilterContactType = string

/** High-level field on the contact (e.g. address vs channel). */
export type RecipientFilterProperty =
  | 'none'
  | 'address'
  | 'channel'
  | 'company'
  | 'contact_profile'
  | 'relationship_partner'
  | 'source'
  | 'email'

/**
 * Sub-field when `property` is `address` (state, city, …) or `contact_profile` (`profile_type` / `profile_subtype`);
 * otherwise `none`.
 */
export type RecipientFilterPropertyType =
  | 'none'
  | 'state'
  | 'city'
  | 'county'
  | 'street'
  | 'profile_type'
  | 'profile_subtype'
  | 'partner_email'
  | 'partner_external_id'
  | 'partner_type'
  | 'partner_owner_email'

export interface RecipientFilterLean {
  _id: Types.ObjectId
  tenantId: string
  name: string
  contactType: RecipientFilterContactType
  property: RecipientFilterProperty
  propertyType: RecipientFilterPropertyType
  propertyValue: string
  enabled: boolean
  createdAt?: Date
  updatedAt?: Date
}
