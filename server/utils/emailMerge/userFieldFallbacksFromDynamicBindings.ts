import type { EmailDynamicVariableBinding } from '@server/utils/emailMerge/composeMergeRoot'
import type { UserMergeSnapshot } from '~~/shared/utils/emailTemplateMerge'

const USER_FIELD_BY_BINDING: Record<string, keyof UserMergeSnapshot> = {
  'user.firstname': 'firstName',
  'user.lastname': 'lastName',
  'user.email': 'email',
  firstname: 'firstName',
  lastname: 'lastName',
  email: 'email',
  ownerfirstname: 'firstName',
  ownerlastname: 'lastName',
  owneremail: 'email'
}

/** Tenant-configured `fallbackValue` for `user.firstName`, `user.lastName`, and `user.email`. */
export function userMergeSnapshotFromDynamicVariableFallbacks(
  bindings: EmailDynamicVariableBinding[] | null | undefined
): UserMergeSnapshot | undefined {
  if (!bindings?.length) return undefined

  const out: UserMergeSnapshot = {}
  for (const binding of bindings) {
    if (binding.sourceType !== 'user') continue
    const fallback = typeof binding.fallbackValue === 'string' ? binding.fallbackValue.trim() : ''
    if (!fallback) continue

    const field =
      USER_FIELD_BY_BINDING[binding.key.trim().toLowerCase()] ??
      USER_FIELD_BY_BINDING[binding.contactPath.trim().toLowerCase()]
    if (!field) continue

    if (field === 'email') {
      if (!out.email) out.email = fallback.toLowerCase()
    } else if (field === 'firstName' && !out.firstName) {
      out.firstName = fallback
    } else if (field === 'lastName' && !out.lastName) {
      out.lastName = fallback
    }
  }

  return Object.keys(out).length ? out : undefined
}
