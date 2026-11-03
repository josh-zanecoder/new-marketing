/**
 * Marketing audience / sender access for CRM–Retail handoff roles.
 * LO + LOA → self only. OM + Marketing → tenant-wide (pick any LO / any borrowers).
 */

export const MARKETING_AUDIENCE_ACCESS_SELF_ONLY = 'self_only' as const
export const MARKETING_AUDIENCE_ACCESS_TENANT_WIDE = 'tenant_wide' as const
export const MARKETING_AUDIENCE_ACCESS_OWNER_SCOPE = 'owner_scope' as const

export type MarketingAudienceAccess =
  | typeof MARKETING_AUDIENCE_ACCESS_SELF_ONLY
  | typeof MARKETING_AUDIENCE_ACCESS_TENANT_WIDE
  | typeof MARKETING_AUDIENCE_ACCESS_OWNER_SCOPE

function normRole(role: string | null | undefined): string {
  return String(role ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
}

/** Loan Officer / Loan Officer Assistant (and Retail broker equivalents). */
export function isLoanOfficerLikeRole(role: string | null | undefined): boolean {
  const r = normRole(role)
  if (!r) return false
  if (r === 'lo' || r === 'loa') return true
  if (r === 'broker' || r === 'broker assistant') return true
  if (r === 'loan officer' || r === 'loan officer assistant') return true
  if (r.includes('loan officer assistant') || r.includes('broker assistant')) return true
  if (r.includes('loan officer') && !r.includes('operations')) return true
  return false
}

/** Operations Manager / Marketing — full LO + borrower visibility. */
export function isFullAccessMarketingRole(role: string | null | undefined): boolean {
  const r = normRole(role)
  if (!r) return false
  if (r === 'om' || r === 'marketing') return true
  if (r === 'operations manager' || r === 'office manager') return true
  if (r.includes('operations manager') || r.includes('office manager')) return true
  if (r === 'marketing' || r.includes('marketing')) return true
  return false
}

export type MarketingAudienceAccessInput = {
  tenantUserRole?: string | null
  tenantWideContacts?: boolean | null
}

/**
 * Resolve how sender / borrower pickers should behave for this session.
 * LO/LOA always self-only (role wins over a mis-set wide flag).
 * OM/Marketing (or `tenantWideContacts`) → full access.
 */
export function resolveMarketingAudienceAccess(
  input: MarketingAudienceAccessInput
): MarketingAudienceAccess {
  if (isLoanOfficerLikeRole(input.tenantUserRole)) {
    return MARKETING_AUDIENCE_ACCESS_SELF_ONLY
  }
  if (isFullAccessMarketingRole(input.tenantUserRole) || input.tenantWideContacts === true) {
    return MARKETING_AUDIENCE_ACCESS_TENANT_WIDE
  }
  return MARKETING_AUDIENCE_ACCESS_OWNER_SCOPE
}

export function isSelfOnlyMarketingAudienceAccess(access: MarketingAudienceAccess): boolean {
  return access === MARKETING_AUDIENCE_ACCESS_SELF_ONLY
}

export function isTenantWideMarketingAudienceAccess(access: MarketingAudienceAccess): boolean {
  return access === MARKETING_AUDIENCE_ACCESS_TENANT_WIDE
}
