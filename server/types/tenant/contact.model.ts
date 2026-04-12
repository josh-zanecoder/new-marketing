import type { Model, Types } from 'mongoose'

/** Per-tenant `contact_types.key` (e.g. lead, buyer); not a fixed global enum. */
export type ContactKind = string

/** Optional structured address; all fields optional for partial CRM sync. */
export interface ContactAddress {
  street?: string
  city?: string
  state?: string
  county?: string
}

/**
 * Segmentation profile on a contact (e.g. retail partner type + subtypes).
 * Keys are stable lowercase ids from Kafka-synced tenant catalog.
 */
export interface ContactProfile {
  /** Top-level profile type key (e.g. real_estate). */
  typeKey: string
  /** Subtype keys under `typeKey`; empty when none assigned. */
  subtypeKeys: string[]
}

export interface ContactLean {
  _id: Types.ObjectId
  externalId?: string
  source?: string
  /** Keys aligned with tenant `ContactType.key`; at least one after sync / save hooks. */
  contactType?: string[]
  firstName: string
  lastName: string
  email: string
  /** Preferred outreach channel (e.g. email for campaigns). */
  channel: string
  phone?: string
  address?: ContactAddress
  company?: string
  /** Optional structured segment (type + subtypes), e.g. synced from retail partners. */
  contactProfile?: ContactProfile | null
  /** CRM / Kafka idempotency; optional until integrations land. */
  /** Arbitrary key-value data from CRM/Kafka (not indexed by default). */
  metadata?: Record<string, unknown>
  createdAt?: Date
  updatedAt?: Date
  deletedAt?: Date | null
}

export type ContactModel = Model<ContactLean>
