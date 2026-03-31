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
