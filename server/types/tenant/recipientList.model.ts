import type { Model, Types } from 'mongoose'
import type { ContactKind } from './contact.model'

/** One condition: field key + value (e.g. state + TX). Lists may have many. */
export interface RecipientListCriterion {
  property: string
  value: string
}

/**
 * How criteria combine: `and` = **AND** across different fields; **OR** among multiple values
 * for the same field (same field cannot hold two values). `or` = any criterion row matches.
 */
export type RecipientListFilterMode = 'and' | 'or'

/** Left-associative combinator between consecutive filter rows (gaps). Length = row count − 1. */
export type RecipientListCriterionJoin = 'and' | 'or'

/** How dynamic list membership is computed; set from session on create/patch. */
export type RecipientListMembershipScope = 'tenant' | 'owner_emails'

/** Tenant-scoped ownership; extend keys here if you add schema fields. */
export interface RecipientListMetadata {
  ownerEmail?: string
}

/** List definition. Contact membership is stored in `recipient_list_members` (see RecipientListMember). */
export interface RecipientListLean {
  _id: Types.ObjectId
  name: string
  audience: ContactKind
  filters: RecipientListCriterion[]
  filterMode?: RecipientListFilterMode
  /** When set (length = filter row count − 1), row clauses combine with left-associative AND/OR. */
  criterionJoins?: RecipientListCriterionJoin[]
  /** Kept for campaign / static flows; default dynamic for criteria-based lists. */
  listType?: 'static' | 'dynamic' | 'hybrid'
  clientId?: string
  metadata?: RecipientListMetadata
  createdBy?: string
  updatedBy?: string
  membershipScope?: RecipientListMembershipScope
  /** Snapshot for `owner_emails` membership; empty for `tenant`. */
  membershipOwnerEmails?: string[]
  createdAt?: Date
  updatedAt?: Date
}

export type RecipientListModel = Model<RecipientListLean>
