export const CONTACT_EVENT_TYPES = {
  CREATED: 'contact.created',
  UPDATED: 'contact.updated',
  DELETED: 'contact.deleted',
} as const

export type ContactEventType = (typeof CONTACT_EVENT_TYPES)[keyof typeof CONTACT_EVENT_TYPES]

export type ContactAddress = {
  street: string
  city: string
  state: string
  county: string
}

export type ContactPayload = {
  externalId: string
  tenantId: string
  dBname: string
  /** Preferred; use together when CRM sends split names. */
  firstName?: string
  lastName?: string
  /** @deprecated inbound-only; stored as firstName when last not sent */
  name?: string
  email: string
  phone?: string
  company: string
  address: ContactAddress
  /** Single CRM / marketing type key (legacy triad or tenant-defined). */
  contactType?: string
  /** Multiple type keys when CRM sends a list (preferred for multi-label). */
  contactTypes?: string[]
  channel: string | null
}

/** Resolve Kafka / CRM payload into stored first + last (no word-splitting). */
export function namesFromContactPayload(p: ContactPayload): { firstName: string; lastName: string } {
  const fn = typeof p.firstName === 'string' ? p.firstName.trim() : ''
  const ln = typeof p.lastName === 'string' ? p.lastName.trim() : ''
  if (fn || ln) return { firstName: fn, lastName: ln }
  const legacy = typeof p.name === 'string' ? p.name.trim() : ''
  return { firstName: legacy, lastName: '' }
}

export type ContactEventEnvelope = {
  eventType: typeof CONTACT_EVENT_TYPES.CREATED | typeof CONTACT_EVENT_TYPES.UPDATED
  occurredAt: string
  dBname: string
  tenantId: string
  payload: ContactPayload
}

export type ContactDeletedPayload = {
  externalId: string
  tenantId: string
  dBname: string
}

export type ContactDeletedEventEnvelope = {
  eventType: typeof CONTACT_EVENT_TYPES.DELETED
  occurredAt: string
  dBname: string
  tenantId: string
  payload: ContactDeletedPayload
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

export function parseContactDeletedEventEnvelope(input: unknown): ContactDeletedEventEnvelope | null {
  if (!isObject(input)) return null
  if (input.eventType !== CONTACT_EVENT_TYPES.DELETED) return null
  if (typeof input.occurredAt !== 'string') return null
  if (typeof input.dBname !== 'string') return null
  if (typeof input.tenantId !== 'string') return null
  if (!isObject(input.payload)) return null
  const p = input.payload
  if (typeof p.externalId !== 'string') return null
  if (typeof p.tenantId !== 'string') return null
  if (typeof p.dBname !== 'string') return null
  return input as ContactDeletedEventEnvelope
}

export function parseContactEventEnvelope(input: unknown): ContactEventEnvelope | null {
  if (!isObject(input)) return null
  const eventType = input.eventType
  if (eventType !== CONTACT_EVENT_TYPES.CREATED && eventType !== CONTACT_EVENT_TYPES.UPDATED) return null
  if (typeof input.occurredAt !== 'string') return null
  if (typeof input.dBname !== 'string') return null
  if (typeof input.tenantId !== 'string') return null
  if (!isObject(input.payload)) return null

  const p = input.payload
  if (typeof p.externalId !== 'string') return null
  if (typeof p.tenantId !== 'string') return null
  if (typeof p.dBname !== 'string') return null
  if (
    !(
      typeof p.name === 'string'
      || typeof p.firstName === 'string'
      || typeof p.lastName === 'string'
    )
  ) {
    return null
  }
  if (typeof p.email !== 'string') return null
  if (!(typeof p.phone === 'string' || typeof p.phone === 'undefined')) return null
  if (typeof p.company !== 'string') return null
  if (!isObject(p.address)) return null
  if (typeof p.address.street !== 'string') return null
  if (typeof p.address.city !== 'string') return null
  if (typeof p.address.state !== 'string') return null
  if (typeof p.address.county !== 'string') return null
  const multi = p.contactTypes
  const single = p.contactType
  const hasTypes =
    (Array.isArray(multi) && multi.some((x) => String(x ?? '').trim())) ||
    (typeof single === 'string' && single.trim()) ||
    (Array.isArray(single) && single.some((x) => String(x ?? '').trim()))
  if (!hasTypes) return null
  if (!(typeof p.channel === 'string' || p.channel === null)) return null

  return input as ContactEventEnvelope
}
