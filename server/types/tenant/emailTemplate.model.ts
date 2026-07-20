import type { Model, Types } from 'mongoose'

export interface EmailTemplateDoc {
  _id: Types.ObjectId
  name: string
  subject?: string
  description?: string
  /** Current schema field */
  htmlTemplate?: string
  htmlSource?: 'editor' | 'upload' | 'custom'
  /** Listed under Saved templates in the design modal when true (default). */
  saveToLibrary?: boolean
  externalId?: string
  categoryId?: Types.ObjectId | null
  /** Soft-delete timestamp; null = active. */
  deletedAt?: Date | null
  /** Legacy field */
  html?: string
  clientId?: string
  css?: string
  createdAt?: Date
  updatedAt?: Date
}

export type EmailTemplateModel = Model<EmailTemplateDoc>
