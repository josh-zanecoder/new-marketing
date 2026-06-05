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
  /**
   * For `recipient`: dot path on Contact at send time (e.g. `firstName`, `address.state`).
   * For `user`: logical path under `user` in merge data (often matches key after `user.`, e.g. `firstName`, `phone`);
   * resolved from the recipient contact's CRM account owner (`metadata.ownerFirstName`, `metadata.ownerPhone`, etc.)
   * before campaign snapshot / session fallback — not the logged-in marketing user at send time.
   */
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
