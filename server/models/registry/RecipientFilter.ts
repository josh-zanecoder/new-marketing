import mongoose from 'mongoose'

const contactTypeEnum = ['prospect', 'client', 'contact'] as const
/** Includes legacy dotted `address.*` values for existing documents. */
const propertyEnum = [
  'none',
  'address',
  'channel',
  'company',
  'source',
  'email',
  'address.state',
  'address.city',
  'address.county',
  'address.street'
] as const
const propertyTypeEnum = ['none', 'state', 'city', 'county', 'street'] as const

const recipientFilterSchema = new mongoose.Schema(
  {
    /** Registry `clients.tenantId` (not db name). */
    tenantId: { type: String, required: true, index: true, trim: true },
    name: { type: String, required: true, trim: true },
    contactType: {
      type: String,
      enum: contactTypeEnum,
      required: true
    },
    property: {
      type: String,
      enum: propertyEnum,
      default: 'none'
    },
    /** Meaningful when `property` is `address` (or legacy `address.*`). */
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

recipientFilterSchema.index({ tenantId: 1, name: 1 }, { unique: true })

export type RecipientFilterDoc = mongoose.InferSchemaType<
  typeof recipientFilterSchema
>

export function getRecipientFilterModel(
  conn: mongoose.Connection
): mongoose.Model<RecipientFilterDoc> {
  const existing = conn.models.RecipientFilter as
    | mongoose.Model<RecipientFilterDoc>
    | undefined
  if (existing) return existing
  return conn.model<RecipientFilterDoc>(
    'RecipientFilter',
    recipientFilterSchema
  )
}
