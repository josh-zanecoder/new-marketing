import mongoose from 'mongoose'

const contactKindEnum = ['prospect', 'client', 'contact'] as const
const listTypeEnum = ['static', 'dynamic', 'hybrid'] as const
const filterModeEnum = ['and', 'or'] as const

const recipientListCriterionSchema = new mongoose.Schema(
  {
    property: { type: String, required: true, trim: true },
    value: { type: String, default: '', trim: true }
  },
  { _id: false }
)

export const recipientListSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    listType: {
      type: String,
      enum: listTypeEnum,
      default: 'dynamic',
      index: true
    },
    audience: {
      type: String,
      enum: contactKindEnum,
      default: 'prospect',
      index: true
    },
    filters: {
      type: [recipientListCriterionSchema],
      default: () => []
    },
    filterMode: {
      type: String,
      enum: filterModeEnum,
      default: 'and'
    },
    /** Legacy shape only (`contactKinds`, `state`, …). New lists omit this. */
    filter: { type: mongoose.Schema.Types.Mixed }
  },
  { timestamps: true, collection: 'recipient_lists' }
)

recipientListSchema.index({ name: 1 })
recipientListSchema.index({ updatedAt: -1 })
