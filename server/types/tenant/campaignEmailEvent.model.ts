import type { Model, Types } from 'mongoose'

export interface CampaignEmailEventLean {
  _id: Types.ObjectId
  campaign: Types.ObjectId
  email: string
  brevoMessageId: string
  event: string
  occurredAt: Date
  reason?: string
  link?: string
  tag?: string
  dedupeKey: string
  createdAt?: Date
  updatedAt?: Date
}

export type CampaignEmailEventModel = Model<CampaignEmailEventLean>

export type CampaignEmailEventInsert = {
  campaign: Types.ObjectId | string
  email: string
  brevoMessageId: string
  event: string
  occurredAt: Date
  reason?: string
  link?: string
  tag?: string
  dedupeKey: string
}
