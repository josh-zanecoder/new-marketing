import type { Model, Types } from 'mongoose'

/** `contact` = generic person record; `prospect` / `client` = CRM-style lifecycle. */
export type ContactKind = 'prospect' | 'client' | 'contact'

/** Optional structured address; all fields optional for partial CRM sync. */
export interface ContactAddress {
  street?: string
  city?: string
  state?: string
  county?: string
}

export interface ContactLean {
  _id: Types.ObjectId
  externalId?: string
  source?: string
  contactKind: ContactKind
  /** Keys aligned with tenant `ContactType.key`; empty on legacy docs until next write. */
  contactType?: string[]
  firstName: string
  lastName: string
  email: string
  /** Preferred outreach channel (e.g. email for campaigns). */
  channel: string
  phone?: string
  address?: ContactAddress
  company?: string
  /** CRM / Kafka idempotency; optional until integrations land. */
  /** Arbitrary key-value data from CRM/Kafka (not indexed by default). */
  metadata?: Record<string, unknown>
  createdAt?: Date
  updatedAt?: Date
  deletedAt?: Date | null
}

export type ContactModel = Model<ContactLean>
