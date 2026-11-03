import { describe, expect, it } from 'vitest'
import {
  marketingAudienceAccessFromAuth,
  marketingAudienceOwnerEmailsFromAuth
} from '../marketingAudienceFromAuth'

const loAuth = {
  type: 'tenantApiKey' as const,
  role: 'tenant' as const,
  tenantName: 'Forge',
  dbName: 'forge_db',
  tenantUserEmail: 'lo@example.com',
  tenantUserRole: 'broker',
  contactOwnerScope: ['lo@example.com', 'other@example.com'],
  tenantWideContacts: undefined as true | undefined
}

describe('marketingAudienceFromAuth feature flag', () => {
  it('uses classic handoff scope when LO-list flag is OFF', () => {
    expect(marketingAudienceAccessFromAuth(loAuth)).toBe('owner_scope')
    expect(marketingAudienceOwnerEmailsFromAuth(loAuth)).toEqual([
      'lo@example.com',
      'other@example.com'
    ])
  })

  it('does not force LO self-only when flag is OFF even for broker role', () => {
    const wideLo = {
      ...loAuth,
      tenantWideContacts: true as const,
      contactOwnerScope: undefined
    }
    expect(marketingAudienceAccessFromAuth(wideLo)).toBe('tenant_wide')
    expect(marketingAudienceOwnerEmailsFromAuth(wideLo)).toBeNull()
  })

  it('applies LO self-only when LO-list flag is ON', () => {
    const flagged = { ...loAuth, allowTenantLoRecipientLists: true as const }
    expect(marketingAudienceAccessFromAuth(flagged)).toBe('self_only')
    expect(marketingAudienceOwnerEmailsFromAuth(flagged)).toEqual(['lo@example.com'])
  })

  it('gives OM tenant_wide when LO-list flag is ON', () => {
    const om = {
      ...loAuth,
      tenantUserRole: 'operations-manager',
      tenantUserEmail: 'om@example.com',
      allowTenantLoRecipientLists: true as const
    }
    expect(marketingAudienceAccessFromAuth(om)).toBe('tenant_wide')
    expect(marketingAudienceOwnerEmailsFromAuth(om)).toBeNull()
  })
})
