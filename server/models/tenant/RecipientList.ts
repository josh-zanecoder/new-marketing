import mongoose from 'mongoose'

const contactKindEnum = ['prospect', 'client', 'contact'] as const
const listTypeEnum = ['static', 'dynamic', 'hybrid'] as const
const filterModeEnum = ['and', 'or'] as const
const criterionJoinEnum = ['and', 'or'] as const
const membershipScopeEnum = ['tenant', 'owner_emails'] as const

const recipientListCriterionSchema = new mongoose.Schema(
  {
    property: { type: String, required: true, trim: true },
    value: { type: String, default: '', trim: true }
  },
  { _id: false }
)

const recipientListFilterRowSchema = new mongoose.Schema(
  {
    recipientFilterId: { type: String, trim: true, default: '' },
    listPropertyValue: { type: String, trim: true, default: '' }
  },
  { _id: false }
)

const recipientListMetadataSchema = new mongoose.Schema(
  {
    /** Lowercased; list scope + membership (same idea as contacts `metadata.ownerEmail`). */
    ownerEmail: { type: String, default: '', trim: true, lowercase: true }
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
    /** Left-associative join between each pair of filter rows; length = filterRows.length − 1. */
    criterionJoins: {
      type: [{ type: String, enum: criterionJoinEnum }],
      default: undefined
    },
    /** Source rows from the tenant UI (registry filter id + value); used to repopulate edit. */
    filterRows: {
      type: [recipientListFilterRowSchema],
      default: () => []
    },
    /** Legacy shape only (`contactKinds`, `state`, …). New lists omit this. */
    filter: { type: mongoose.Schema.Types.Mixed },
    metadata: { type: recipientListMetadataSchema, default: () => ({}) },
    /** Tenant user id who created the list. */
    createdBy: { type: String, default: '', trim: true },
    /** Tenant user id who last edited the list (owner metadata is not changed on patch). */
    updatedBy: { type: String, default: '', trim: true },
    /**
     * `tenant` = all matching contacts in the DB; `owner_emails` = scoped pool (see sync/rebuild).
     * Set from session on create/patch.
     */
    membershipScope: {
      type: String,
      enum: membershipScopeEnum,
      default: 'owner_emails',
      index: true
    },
    /**
     * For `owner_emails`: lowercased emails used for contact owner filter (snapshot of session scope).
     * Empty when `tenant` or before backfill.
     */
    membershipOwnerEmails: {
      type: [{ type: String, trim: true, lowercase: true }],
      default: () => []
    }
  },
  { timestamps: true, collection: 'recipient_lists' }
)

recipientListSchema.index({ name: 1 })
recipientListSchema.index({ updatedAt: -1 })
recipientListSchema.index({ 'metadata.ownerEmail': 1 })
