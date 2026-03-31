import type { Model, Types } from 'mongoose'

export type EmailDynamicVariableScope = 'subject' | 'body'

export type EmailDynamicVariableSourceType = 'recipient' | 'user'

export interface EmailDynamicVariableDoc {
  _id: Types.ObjectId
  /** Path inside `{{...}}` in templates — e.g. `user.firstName` -> `{{user.firstName}}`. */
  key: string
  /** Display label in admin / tenant pickers. */
  label: string
  description?: string
  /** Dot path on Contact at send time (e.g. `name`, `email`, `company`, `address.state`). */
  contactPath: string
  sourceType?: EmailDynamicVariableSourceType
  scopes: EmailDynamicVariableScope[]
  enabled: boolean
  sortOrder: number
  fallbackValue?: string
  requiredForSend: boolean
  createdAt?: Date
  updatedAt?: Date
}

export type EmailDynamicVariableModel = Model<EmailDynamicVariableDoc>
