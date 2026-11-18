import type { Model, Types } from 'mongoose'

export interface FlyerDoc {
  _id: Types.ObjectId
  name: string
  categoryId?: Types.ObjectId | null
  imageUrl: string
  objectPath: string
  fileName?: string
  contentType?: string
  size?: number
  createdAt?: Date
  updatedAt?: Date
}

export type FlyerModel = Model<FlyerDoc>
