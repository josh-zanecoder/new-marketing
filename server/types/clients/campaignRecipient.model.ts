import type { Model, Types } from 'mongoose'

export interface CampaignRecipientLean {
  _id: Types.ObjectId
  campaign: Types.ObjectId
  email: string
  status?: string
  sentAt?: Date
  error?: string
  clientId?: string
}

export interface CampaignRecipientInsertPending {
  campaign: string
  email: string
  status: 'pending'
  clientId: string
}

export interface CampaignRecipientInsertFailed {
  campaign: string
  email: string
  status: 'failed'
  clientId: string
  error: string
}

export type CampaignRecipientInsertRow = CampaignRecipientInsertPending | CampaignRecipientInsertFailed

export type CampaignRecipientModel = Model<CampaignRecipientLean>
