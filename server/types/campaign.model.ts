import type { Model, Types } from 'mongoose'

export interface CampaignLean {
  _id: Types.ObjectId
  name: string
  sender: { name: string; email: string }
  recipientsType: 'manual' | 'list'
  recipientsListId?: string
  subject: string
  status: string
  emailTemplate?: Types.ObjectId
  createdAt?: Date
  updatedAt?: Date
  clientId?: string
}

export interface CampaignDoc {
  _id: Types.ObjectId
}

/** Documents that store a reference to a campaign. */
export interface WithCampaignRef {
  campaign: Types.ObjectId
}

export type CampaignModel = Model<CampaignLean>