import mongoose from 'mongoose'

const campaignStatusEnum = ['Draft', 'Scheduled', 'Sending', 'Sent', 'Failed'] as const
const recipientsTypeEnum = ['manual', 'list'] as const

const mergeUserSnapshotSchema = new mongoose.Schema(
  {
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    email: { type: String, trim: true },
    phone: { type: String, trim: true },
    role: { type: String, trim: true }
  },
  { _id: false }
)

const campaignMetadataSchema = new mongoose.Schema(
  {
    /** Tenant user id of the owner (ACL / filtering). */
    owner: { type: String, default: '', trim: true },
    /** Lowercased; used with `contactOwnerScope` like contacts. */
    ownerEmail: { type: String, default: '', trim: true, lowercase: true }
  },
  { _id: false }
)

export const campaignSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sender: {
    name: { type: String, required: true },
    email: { type: String, required: true }
  },
  recipientsType: { type: String, enum: recipientsTypeEnum, default: 'manual' },
  recipientsListId: { type: String, default: '' },
  emailTemplate: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailTemplate' },
  subject: { type: String, default: '' },
  status: { type: String, enum: campaignStatusEnum, default: 'Draft' },
  /** When set, campaign is intended to start sending at this instant (UTC). Typically used with status `Scheduled`. */
  scheduledAt: { type: Date, required: false },
  clientId: { type: String, default: '' },
  /** CRM user profile at last save; used at send time for {{ user.* }} when worker has no session. */
  mergeUserSnapshot: { type: mergeUserSnapshotSchema, required: false },
  metadata: { type: campaignMetadataSchema, default: () => ({}) },
  /** Tenant user id who created the campaign. */
  createdBy: { type: String, default: '', trim: true },
  /** Tenant user id who last edited the campaign (owner fields above are not changed on edit). */
  updatedBy: { type: String, default: '', trim: true }
}, { timestamps: true })

campaignSchema.index({ 'metadata.owner': 1 })
campaignSchema.index({ 'metadata.ownerEmail': 1 })
