import {
  isTenantApiKeyAuthContext,
  tenantCreatedByFromAuth,
  tenantUserEmailFromAuth
} from '@server/tenant/registry-auth'

type TemplateOwnershipDoc = {
  metadata?: { ownerEmail?: string | null } | null
}

const SHARED_TEMPLATE_FILTER = {
  $or: [
    { 'metadata.ownerEmail': { $exists: false } },
    { 'metadata.ownerEmail': null },
    { 'metadata.ownerEmail': '' }
  ]
}

/**
 * Owner-scoped session (CRM handoff without `tenantWideContacts`). Tenant-wide, Firebase and
 * admin sessions manage shared templates and see every template.
 */
function ownerScopedEmails(auth: unknown): string[] | null {
  if (!isTenantApiKeyAuthContext(auth)) return null
  if (auth.tenantWideContacts === true) return null
  return (auth.contactOwnerScope ?? [])
    .map((e) => (typeof e === 'string' ? e.trim().toLowerCase() : ''))
    .filter(Boolean)
}

export function emailTemplateOwnerEmail(doc: TemplateOwnershipDoc | null | undefined): string {
  return String(doc?.metadata?.ownerEmail ?? '').trim().toLowerCase()
}

/**
 * Fields for a new template. Owner-scoped users get a private template; tenant-wide users
 * create shared (company) templates.
 */
export function emailTemplateOwnershipFromAuth(auth: unknown): {
  createdBy?: string
  metadata?: { ownerEmail: string }
} {
  const createdBy = tenantCreatedByFromAuth(auth)
  const ownerEmail = ownerScopedEmails(auth) ? tenantUserEmailFromAuth(auth) : ''
  return {
    ...(createdBy ? { createdBy } : {}),
    ...(ownerEmail ? { metadata: { ownerEmail } } : {})
  }
}

/** Read filter: shared templates plus private templates owned by someone in the session scope. */
export function mergeEmailTemplateVisibilityFilter(
  base: Record<string, unknown>,
  auth: unknown
): Record<string, unknown> {
  const scope = ownerScopedEmails(auth)
  if (!scope) return base
  if (!scope.length) return { $and: [base, SHARED_TEMPLATE_FILTER] }
  return {
    $and: [base, { $or: [...SHARED_TEMPLATE_FILTER.$or, { 'metadata.ownerEmail': { $in: scope } }] }]
  }
}

/** Owner-scoped users may only edit or delete private templates in their scope. */
export function canWriteEmailTemplate(
  doc: TemplateOwnershipDoc | null | undefined,
  auth: unknown
): boolean {
  if (!doc) return false
  const scope = ownerScopedEmails(auth)
  if (!scope) return true
  const owner = emailTemplateOwnerEmail(doc)
  return Boolean(owner) && scope.includes(owner)
}
