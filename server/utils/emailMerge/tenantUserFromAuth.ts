import {
  type UserMergeSnapshot,
  userMergeSnapshotFromContactOwnerMetadata
} from '../../../shared/utils/emailTemplateMerge'
import { isTenantApiKeyAuthContext } from '@server/tenant/registry-auth'

/**
 * Maps the current tenant API session to `user.*` merge fields (sender / operator).
 * Does not query the database — reads `event.context.auth` shape only.
 */
export function tenantUserFieldsFromAuth(auth: unknown): UserMergeSnapshot | undefined {
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

/** Prefer session fields; fill gaps from campaign snapshot (e.g. phone saved at campaign create). */
export function mergeUserSnapshotsForEmail(
  ...sources: Array<UserMergeSnapshot | null | undefined>
): UserMergeSnapshot | undefined {
  const out: UserMergeSnapshot = {}
  for (const src of sources) {
    if (!src) continue
    if (!out.firstName && src.firstName) out.firstName = src.firstName
    if (!out.lastName && src.lastName) out.lastName = src.lastName
    if (!out.email && src.email) out.email = src.email
    if (!out.phone && src.phone) out.phone = src.phone
    if (!out.role && src.role) out.role = src.role
  }
  return Object.keys(out).length ? out : undefined
}

/** CRM account owner fields synced on the contact (`metadata.ownerFirstName`, etc.). */
export function userMergeSnapshotFromContactOwner(
  contact: { metadata?: Record<string, unknown> } | null | undefined
): UserMergeSnapshot | undefined {
  return userMergeSnapshotFromContactOwnerMetadata(contact?.metadata)
}

/**
 * `user.*` template tokens at send/preview: account owner on the recipient contact first,
 * then campaign snapshot / session for any missing fields (e.g. phone, role).
 */
export function mergeUserSnapshotForContact(
  contact: { metadata?: Record<string, unknown> } | null | undefined,
  ...fallbacks: Array<UserMergeSnapshot | null | undefined>
): UserMergeSnapshot | undefined {
  return mergeUserSnapshotsForEmail(userMergeSnapshotFromContactOwner(contact), ...fallbacks)
}
