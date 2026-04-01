import mongoose from 'mongoose'

/** Where a variable may be inserted in the tenant email UI / templates. */
const dynamicScopeEnum = ['subject', 'body'] as const
const dynamicSourceTypeEnum = ['recipient', 'user'] as const

/**
 * One allowed dynamic token for campaigns / templates (e.g. superadmin-managed catalog per tenant).
 * `key` is the path inside mustache-style tags: key `user.firstName` -> `{{user.firstName}}`.
 * `contactPath` is resolved at send time: raw Contact fields (`address.state`, `metadata.foo`) plus the same flat keys as `{{ recipient.* }}` (`city`, `company`) and optional `recipient.firstName`-style paths.
 */
export const emailDynamicVariableSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true
    },
    label: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    contactPath: { type: String, required: true, trim: true },
    sourceType: {
      type: String,
      enum: dynamicSourceTypeEnum,
      default: 'recipient'
    },
    scopes: {
      type: [{ type: String, enum: dynamicScopeEnum }],
      default: () => [...dynamicScopeEnum]
    },
    enabled: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },
    /** When the contact value is missing/empty, substitute this (otherwise merge engine may use empty string). */
    fallbackValue: { type: String, default: '', trim: true },
    /**
     * If true, send pipeline may mark recipient failed when value is missing (policy enforced in service layer).
     */
    requiredForSend: { type: Boolean, default: false }
  },
  { timestamps: true, collection: 'email_dynamic_variables' }
)

emailDynamicVariableSchema.index({ key: 1 }, { unique: true })
emailDynamicVariableSchema.index({ enabled: 1, sortOrder: 1 })
