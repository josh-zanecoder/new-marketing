import mongoose from 'mongoose'
/** Includes legacy dotted `address.*` values for existing documents. */
const propertyEnum = [
  'none',
  'address',
  'channel',
  'company',
  'contact_profile',
  'address.state',
  'address.city',
  'address.county',
  'address.street'
] as const
const propertyTypeEnum = [
  'none',
  'state',
  'city',
  'county',
  'street',
  'profile_type',
  'profile_subtype'
] as const

/** Audience filters for recipient lists; one physical DB per tenant (no tenantId field). */
export const recipientFilterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    contactType: {
      type: String,
      trim: true,
      required: true
    },
    property: {
      type: String,
      enum: propertyEnum,
      default: 'none'
    },
    propertyType: {
      type: String,
      enum: propertyTypeEnum,
      default: 'none'
    },
    propertyValue: { type: String, default: '' },
    enabled: { type: Boolean, default: true }
  },
  { timestamps: true, collection: 'recipient_filters' }
)

recipientFilterSchema.index({ name: 1 }, { unique: true })

export type RecipientFilterDoc = mongoose.InferSchemaType<
  typeof recipientFilterSchema
>
