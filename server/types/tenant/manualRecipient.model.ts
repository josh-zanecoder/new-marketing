import type { Model, Types } from 'mongoose'

export interface ManualRecipientLean {
  _id: Types.ObjectId
  campaign: Types.ObjectId
  contact: Types.ObjectId
  clientId?: string
}

export interface ManualRecipientInsert {
  campaign: Types.ObjectId
  contact: Types.ObjectId
  clientId: string
}

/** For `insertMany` on untyped mongoose models: timestamps/`_id` are applied at runtime. */
export type ManualRecipientInsertManyCast = Omit<ManualRecipientLean, '_id'>

export type ManualRecipientModel = Model<ManualRecipientLean>
