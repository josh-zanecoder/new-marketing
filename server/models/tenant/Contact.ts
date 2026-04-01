import mongoose from 'mongoose'

const contactKindEnum = ['prospect', 'client', 'contact'] as const

const addressSchema = new mongoose.Schema(
  {
    street: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    county: { type: String, default: '' }
  },
  { _id: false }
)

export const contactSchema = new mongoose.Schema(
  {
    externalId: { type: String, default: '' },
    source: { type: String, default: '' },
    contactKind: {
      type: String,
      enum: contactKindEnum,
      required: true,
      index: true
    },
    firstName: { type: String, required: true, trim: true, default: '' },
    lastName: { type: String, required: true, trim: true, default: '' },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, default: '', trim: true },
    address: { type: addressSchema, default: () => ({}) },
    company: { type: String, default: '', trim: true },
    /** Outreach / attribution channel (e.g. email, sms, linkedin); free-form for CRM sync. */
    channel: { type: String, default: 'email', trim: true },
    /** CRM / integration extras (tags, custom fields, raw sync payload slices). */
    metadata: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

contactSchema.index({ email: 1, contactKind: 1 })
contactSchema.index({ externalId: 1, source: 1 }, { sparse: true })
contactSchema.index({ company: 1 })
contactSchema.index({ deletedAt: 1 })
