import type { Model, Types } from 'mongoose'

/** One row: a contact belongs to a recipient list (collection `recipient_list_members`). */
export interface RecipientListMemberLean {
  _id: Types.ObjectId
  recipientListId: Types.ObjectId
  contactId: Types.ObjectId
  createdAt?: Date
}

export type RecipientListMemberModel = Model<RecipientListMemberLean>
