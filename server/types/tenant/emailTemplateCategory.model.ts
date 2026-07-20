import type { Model, Types } from 'mongoose'

export interface EmailTemplateCategoryDoc {
  _id: Types.ObjectId
  name: string
  description?: string
  sortOrder?: number
  createdAt?: Date
  updatedAt?: Date
}

export type EmailTemplateCategoryModel = Model<EmailTemplateCategoryDoc>
