import type { Model, Types } from 'mongoose'

export interface EmailTemplateDoc {
  _id: Types.ObjectId
  name: string
  subject?: string
  /** Current schema field */
  htmlTemplate?: string
  /** Legacy field */
  html?: string
  clientId?: string
  css?: string
}

export type EmailTemplateModel = Model<EmailTemplateDoc>
