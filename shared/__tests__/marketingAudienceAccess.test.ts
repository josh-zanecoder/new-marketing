import { describe, expect, it } from 'vitest'
import {
  isFullAccessMarketingRole,
  isLoanOfficerLikeRole,
  resolveMarketingAudienceAccess
} from '../marketingAudienceAccess'

describe('isLoanOfficerLikeRole', () => {
  it('matches Retail broker / LOA roles', () => {
    expect(isLoanOfficerLikeRole('broker')).toBe(true)
    expect(isLoanOfficerLikeRole('broker-assistant')).toBe(true)
    expect(isLoanOfficerLikeRole('loan_officer')).toBe(true)
    expect(isLoanOfficerLikeRole('Loan Officer Assistant')).toBe(true)
  })

  it('rejects OM and marketing', () => {
    expect(isLoanOfficerLikeRole('operations-manager')).toBe(false)
    expect(isLoanOfficerLikeRole('marketing')).toBe(false)
  })
})

describe('isFullAccessMarketingRole', () => {
  it('matches OM and marketing', () => {
    expect(isFullAccessMarketingRole('operations-manager')).toBe(true)
    expect(isFullAccessMarketingRole('marketing')).toBe(true)
    expect(isFullAccessMarketingRole('Office Manager')).toBe(true)
  })
})

describe('resolveMarketingAudienceAccess', () => {
  it('forces self_only for LO/LOA even if wide flag is somehow set', () => {
    expect(
      resolveMarketingAudienceAccess({
        tenantUserRole: 'broker',
        tenantWideContacts: true
      })
    ).toBe('self_only')
    expect(
      resolveMarketingAudienceAccess({
        tenantUserRole: 'broker-assistant',
        tenantWideContacts: false
      })
    ).toBe('self_only')
  })

  it('gives tenant_wide to OM and marketing', () => {
    expect(
      resolveMarketingAudienceAccess({
        tenantUserRole: 'operations-manager',
        tenantWideContacts: false
      })
    ).toBe('tenant_wide')
    expect(
      resolveMarketingAudienceAccess({
        tenantUserRole: 'marketing',
        tenantWideContacts: false
      })
    ).toBe('tenant_wide')
  })

  it('falls back to owner_scope for unknown roles without wide flag', () => {
    expect(
      resolveMarketingAudienceAccess({
        tenantUserRole: 'processor',
        tenantWideContacts: false
      })
    ).toBe('owner_scope')
  })
})
