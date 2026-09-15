import { describe, expect, it } from 'vitest'
import { tenantUserFieldsFromAuth } from '../tenantUserFromAuth'

describe('tenantUserFieldsFromAuth', () => {
  it('reads the CRM handoff session email for test-email AE merge', () => {
    expect(
      tenantUserFieldsFromAuth({
        type: 'tenantApiKey',
        role: 'tenant',
        tenantName: 'fcl',
        dbName: 'tenant_fcl',
        tenantUserEmail: 'Lane.Thompson@fcltpo.com',
        tenantUserFirstName: 'Lane',
        tenantUserLastName: 'Thompson'
      })
    ).toEqual({
      email: 'lane.thompson@fcltpo.com',
      firstName: 'Lane',
      lastName: 'Thompson'
    })
  })

  it('returns undefined when the session has no operator profile', () => {
    expect(
      tenantUserFieldsFromAuth({
        type: 'tenantApiKey',
        role: 'tenant',
        tenantName: 'fcl',
        dbName: 'tenant_fcl'
      })
    ).toBeUndefined()
  })
})
