import type { Types } from 'mongoose'

/** Tenant `contact_types` key (normalized lowercase in APIs; see `parseAudienceKey`). */
export type RecipientFilterContactType = string

/** High-level field on the contact (e.g. address vs channel). */
export type RecipientFilterProperty =
  | 'none'
  | 'address'
  | 'channel'
  | 'company'
  | 'source'
  | 'email'

/** Sub-field when `property` is `address`; otherwise always `none`. */
export type RecipientFilterPropertyType =
  | 'none'
  | 'state'
  | 'city'
  | 'county'
  | 'street'

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
