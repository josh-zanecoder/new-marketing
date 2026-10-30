import {
  isTenantApiKeyAuthContext,
  tenantUserEmailFromAuth,
  type RegisteredTenantAuthContext
} from '@server/tenant/registry-auth'
import {
  MARKETING_AUDIENCE_ACCESS_OWNER_SCOPE,
  MARKETING_AUDIENCE_ACCESS_SELF_ONLY,
  MARKETING_AUDIENCE_ACCESS_TENANT_WIDE,
  resolveMarketingAudienceAccess,
  type MarketingAudienceAccess
} from '~~/shared/marketingAudienceAccess'

/** Role-based LO/OM rules only when the LO-list feature flag is on the session. */
function loAudienceFeatureEnabled(auth: unknown): boolean {
  return isTenantApiKeyAuthContext(auth) && auth.allowTenantLoRecipientLists === true
}

/**
 * Classic handoff audience (feature flag OFF): tenant-wide or contactOwnerScope.
 * No LO/OM role overrides.
 */
function classicMarketingAudienceAccess(auth: unknown): MarketingAudienceAccess {
  if (!isTenantApiKeyAuthContext(auth)) return MARKETING_AUDIENCE_ACCESS_TENANT_WIDE
  if (auth.tenantWideContacts === true) return MARKETING_AUDIENCE_ACCESS_TENANT_WIDE
  return MARKETING_AUDIENCE_ACCESS_OWNER_SCOPE
}

function classicMarketingAudienceOwnerEmails(auth: unknown): string[] | null {
  if (!isTenantApiKeyAuthContext(auth)) return null
  if (auth.tenantWideContacts === true) return null
  const scope = (auth.contactOwnerScope ?? [])
    .map((e) => (typeof e === 'string' ? e.trim().toLowerCase() : ''))
    .filter(Boolean)
  return scope
}

export function marketingAudienceAccessFromAuth(auth: unknown): MarketingAudienceAccess {
  if (!isTenantApiKeyAuthContext(auth)) return MARKETING_AUDIENCE_ACCESS_TENANT_WIDE
  if (!loAudienceFeatureEnabled(auth)) return classicMarketingAudienceAccess(auth)
  return resolveMarketingAudienceAccess({
    tenantUserRole: auth.tenantUserRole,
    tenantWideContacts: auth.tenantWideContacts === true
  })
}

/**
 * Owner emails this session may use for sender / borrower pickers.
 * - `null` → tenant-wide (no filter)
 * - `[]` → no access
 * - non-empty → restrict to these emails
 *
 * When LO-list flag is OFF → classic handoff scope only.
 */
export function marketingAudienceOwnerEmailsFromAuth(auth: unknown): string[] | null {
  if (!loAudienceFeatureEnabled(auth)) {
    return classicMarketingAudienceOwnerEmails(auth)
  }

  const access = marketingAudienceAccessFromAuth(auth)
  if (access === MARKETING_AUDIENCE_ACCESS_TENANT_WIDE) return null

  const self = tenantUserEmailFromAuth(auth).trim().toLowerCase()

  if (access === MARKETING_AUDIENCE_ACCESS_SELF_ONLY) {
    return self ? [self] : []
  }

  // owner_scope: handoff contactOwnerScope (may include downline); always include self.
  if (!isTenantApiKeyAuthContext(auth)) return self ? [self] : []
  const scope = (auth.contactOwnerScope ?? [])
    .map((e) => (typeof e === 'string' ? e.trim().toLowerCase() : ''))
    .filter(Boolean)
  const out = new Set<string>(scope)
  if (self) out.add(self)
  return [...out]
}

export function marketingAudienceAccessPayload(auth: unknown): {
  audienceAccess: MarketingAudienceAccess
  canSelectAnyLoanOfficer: boolean
} {
  const audienceAccess = marketingAudienceAccessFromAuth(auth)
  return {
    audienceAccess,
    canSelectAnyLoanOfficer: audienceAccess === MARKETING_AUDIENCE_ACCESS_TENANT_WIDE
  }
}

/** Narrow a RegisteredTenantAuthContext contact scope for LO/LOA self-only sessions. */
export function applyMarketingAudienceToAuthScope(
  auth: RegisteredTenantAuthContext
): RegisteredTenantAuthContext {
  if (!loAudienceFeatureEnabled(auth)) return auth
  const emails = marketingAudienceOwnerEmailsFromAuth(auth)
  if (emails === null) {
    return { ...auth, tenantWideContacts: true, contactOwnerScope: undefined }
  }
  return {
    ...auth,
    tenantWideContacts: undefined,
    contactOwnerScope: emails
  }
}
