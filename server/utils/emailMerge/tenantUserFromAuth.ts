import {
  type UserMergeSnapshot,
  userMergeSnapshotFromContactOwnerMetadata
} from '../../../shared/utils/emailTemplateMerge'
import {
  isFirebaseTenantAuthContext,
  isTenantApiKeyAuthContext,
  tenantUserEmailFromAuth
} from '@server/tenant/registry-auth'

/**
 * Maps the current tenant session to `user.*` merge fields (sender / operator).
 * Does not query the database — reads `event.context.auth` shape only.
 */
export function tenantUserFieldsFromAuth(auth: unknown): UserMergeSnapshot | undefined {
  const out: UserMergeSnapshot = {}
  const emailFromAuth = tenantUserEmailFromAuth(auth)
  if (emailFromAuth) out.email = emailFromAuth

  if (isTenantApiKeyAuthContext(auth)) {
    const a = auth
    const raw = a as Record<string, unknown>
    const firstName = a.tenantUserFirstName || (typeof raw.firstName === 'string' ? raw.firstName : '')
    const lastName = a.tenantUserLastName || (typeof raw.lastName === 'string' ? raw.lastName : '')
    const phone = a.tenantUserPhone || (typeof raw.phone === 'string' ? raw.phone : '')
    const crmRole =
      a.tenantUserRole
      || (typeof raw.tenantRole === 'string' ? raw.tenantRole : '')
    if (!out.email) {
      const rawEmail = typeof raw.email === 'string' ? raw.email.trim().toLowerCase() : ''
      if (rawEmail) out.email = rawEmail
    }
    if (firstName) out.firstName = firstName
    if (lastName) out.lastName = lastName
    if (phone) out.phone = phone
    if (crmRole && crmRole !== 'tenant') out.role = crmRole
  } else if (isFirebaseTenantAuthContext(auth) && auth.email?.trim()) {
    if (!out.email) out.email = auth.email.trim().toLowerCase()
  }

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
 * Account owner on the recipient contact only (for template `user.*` merge).
 * Per-variable `fallbackValue` in `email_dynamic_variables` applies when owner fields are empty.
 */
export function mergeUserSnapshotForContact(
  contact: { metadata?: Record<string, unknown> } | null | undefined
): UserMergeSnapshot | undefined {
  return userMergeSnapshotFromContactOwner(contact)
}
