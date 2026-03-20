import type { Model, Types } from 'mongoose'

export interface EmailTemplateDoc {
  _id: Types.ObjectId
  name: string
  html: string
  clientId?: string
  css?: string
}

export type EmailTemplateModel = Model<EmailTemplateDoc>
