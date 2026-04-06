import type { Model, Types } from 'mongoose'

/** Persisted CRM user fields for template tokens {{ user.firstName }}, etc. */
export interface CampaignMergeUserSnapshot {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  role?: string
}

/** Tenant-scoped ownership; extend keys here if you add schema fields. */
export interface CampaignMetadata {
  owner?: string
  ownerEmail?: string
}

export interface CampaignLean {
  _id: Types.ObjectId
  name: string
  sender: { name: string; email: string }
  recipientsType: 'manual' | 'list'
  recipientsListId?: string
  subject: string
  status: string
  /** Fire time for scheduled send (stored in Mongo as UTC). */
  scheduledAt?: Date
  emailTemplate?: Types.ObjectId
  createdAt?: Date
  updatedAt?: Date
  clientId?: string
  mergeUserSnapshot?: CampaignMergeUserSnapshot
  metadata?: CampaignMetadata
  createdBy?: string
  updatedBy?: string
}

export interface CampaignDoc {
  _id: Types.ObjectId
}

/** Documents that store a reference to a campaign. */
export interface WithCampaignRef {
  campaign: Types.ObjectId
}

export type CampaignModel = Model<CampaignLean>
