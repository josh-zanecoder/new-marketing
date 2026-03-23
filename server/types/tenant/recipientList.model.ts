import type { Model, Types } from 'mongoose'
import type { ContactKind } from './contact.model'

/** One condition: field key + value (e.g. state + TX). Lists may have many. */
export interface RecipientListCriterion {
  property: string
  value: string
}

/** List definition. Contact membership is stored in `recipient_list_members` (see RecipientListMember). */
export interface RecipientListLean {
  _id: Types.ObjectId
  name: string
  audience: ContactKind
  filters: RecipientListCriterion[]
  /** Kept for campaign / static flows; default dynamic for criteria-based lists. */
  listType?: 'static' | 'dynamic' | 'hybrid'
  clientId?: string
  createdAt?: Date
  updatedAt?: Date
}

export type RecipientListModel = Model<RecipientListLean>
