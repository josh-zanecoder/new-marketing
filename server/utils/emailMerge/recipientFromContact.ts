import type { ContactLean } from '@server/types/tenant/contact.model'
import { formatContactFullName } from '@server/utils/contactPersonName'

/** Minimal CRM contact shape needed for `recipient.*` merge tokens. */
export type CrmContactFieldsForMerge = {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  company?: string
  contactKind?: string
  /** Marketing contact-type keys (same as stored `contactType` on Contact). */
  contactType?: string[]
  channel?: string
  address?: {
    street?: string
    city?: string
    state?: string
    county?: string
  }
}

/**
 * Maps a tenant `Contact` into flat `recipient.*` merge fields.
 * Uses only `firstName` and `lastName` on the document (no legacy single `name` field).
 */
export function recipientFieldsFromContact(
  contact: CrmContactFieldsForMerge | null | undefined
): Record<string, unknown> | undefined {
  if (!contact || typeof contact !== 'object') return undefined
  const out: Record<string, unknown> = {}
  const firstName =
    typeof contact.firstName === 'string' ? contact.firstName.trim() : ''
  const lastName =
    typeof contact.lastName === 'string' ? contact.lastName.trim() : ''
  const full = formatContactFullName(firstName, lastName)
  if (full) out.name = full
  if (firstName) out.firstName = firstName
  if (lastName) out.lastName = lastName
  if (contact.email) out.email = contact.email
  if (contact.phone) out.phone = contact.phone
  if (contact.company) out.company = contact.company
  if (contact.contactKind) out.contactKind = contact.contactKind
  if (Array.isArray(contact.contactType) && contact.contactType.length) {
    out.contactType = contact.contactType.join(', ')
  }
  if (contact.channel) out.channel = contact.channel
  if (contact.address?.street) out.street = contact.address.street
  if (contact.address?.city) out.city = contact.address.city
  if (contact.address?.state) out.state = contact.address.state
  if (contact.address?.county) out.county = contact.address.county
  return Object.keys(out).length ? out : undefined
}

/**
 * Object used to resolve admin `contactPath` for recipient-sourced dynamic variables.
 * Merges raw CRM fields (e.g. `address.state`, `metadata.*`) with the same flat keys as
 * `{{ recipient.* }}` so paths like `city` or `recipient.firstName` work at send time.
 */
export function contactLookupRecordForDynamicVariables(
  contact: ContactLean | null | undefined
): Record<string, unknown> | null {
  if (!contact || typeof contact !== 'object') return null
  const raw = contact as unknown as Record<string, unknown>
  const flat = recipientFieldsFromContact(contact) ?? {}
  return {
    ...raw,
    ...flat,
    recipient: flat
  }
}
