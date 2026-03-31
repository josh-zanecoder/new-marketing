import type { UserMergeSnapshot } from '../../app/utils/emailTemplateMerge'
import { isTenantApiKeyAuthContext } from '../tenant/registry-auth'

/** Logged-in tenant operator profile from API-key / handoff session (for `user.*` merge fields). */
export function mergeUserSnapshotFromTenantAuth(auth: unknown): UserMergeSnapshot | undefined {
  if (!isTenantApiKeyAuthContext(auth)) return undefined
  const a = auth
  const raw = a as Record<string, unknown>
  const out: UserMergeSnapshot = {}
  const firstName = a.tenantUserFirstName || (typeof raw.firstName === 'string' ? raw.firstName : '')
  const lastName = a.tenantUserLastName || (typeof raw.lastName === 'string' ? raw.lastName : '')
  const email = a.tenantUserEmail || (typeof raw.email === 'string' ? raw.email : '')
  const phone = a.tenantUserPhone || (typeof raw.phone === 'string' ? raw.phone : '')
  const role =
    a.tenantUserRole
    || (typeof raw.tenantRole === 'string' ? raw.tenantRole : '')
    || (typeof raw.role === 'string' ? raw.role : '')
  if (firstName) out.firstName = firstName
  if (lastName) out.lastName = lastName
  if (email) out.email = email
  if (phone) out.phone = phone
  if (role) out.role = role
  return Object.keys(out).length ? out : undefined
}

type ContactMergeSource = {
  name?: string
  email?: string
  phone?: string
  company?: string
  contactKind?: string
  channel?: string
  address?: {
    street?: string
    city?: string
    state?: string
    county?: string
  }
}

function splitNameParts(name: string): { firstName: string; lastName: string } {
  const clean = name.trim()
  if (!clean) return { firstName: '', lastName: '' }
  const parts = clean.split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return { firstName: parts[0] || '', lastName: '' }
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') }
}

/** Recipient profile from tenant contact record (for `recipient.*` merge fields). */
export function mergeRecipientSnapshotFromContact(
  contact: ContactMergeSource | null | undefined
): Record<string, unknown> | undefined {
  if (!contact || typeof contact !== 'object') return undefined
  const out: Record<string, unknown> = {}
  const name = typeof contact.name === 'string' ? contact.name.trim() : ''
  const nameParts = splitNameParts(name)
  if (name) out.name = name
  if (nameParts.firstName) out.firstName = nameParts.firstName
  if (nameParts.lastName) out.lastName = nameParts.lastName
  if (contact.email) out.email = contact.email
  if (contact.phone) out.phone = contact.phone
  if (contact.company) out.company = contact.company
  if (contact.contactKind) out.contactKind = contact.contactKind
  if (contact.channel) out.channel = contact.channel
  if (contact.address?.street) out.street = contact.address.street
  if (contact.address?.city) out.city = contact.address.city
  if (contact.address?.state) out.state = contact.address.state
  if (contact.address?.county) out.county = contact.address.county
  return Object.keys(out).length ? out : undefined
}
