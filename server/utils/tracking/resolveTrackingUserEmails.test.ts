import { describe, expect, it } from 'vitest'
import { resolveTrackingUserEmails } from './resolveTrackingTenantContext'

describe('resolveTrackingUserEmails', () => {
  it('is tenant-wide for non API-key auth', () => {
    expect(resolveTrackingUserEmails({ role: 'tenant', dbName: 'x' })).toBeNull()
  })

  it('is tenant-wide when tenantWideContacts is set', () => {
    expect(
      resolveTrackingUserEmails({
        type: 'tenantApiKey',
        role: 'tenant',
        dbName: 'forge_capital_lending_db',
        tenantName: 'Forge',
        tenantWideContacts: true,
        contactOwnerScope: ['alice@example.com']
      })
    ).toBeNull()
  })

  it('returns owner scope emails when not tenant-wide', () => {
    expect(
      resolveTrackingUserEmails({
        type: 'tenantApiKey',
        role: 'tenant',
        dbName: 'forge_capital_lending_db',
        tenantName: 'Forge',
        contactOwnerScope: ['Alice@Example.com', 'bob@example.com', 'alice@example.com']
      })
    ).toEqual(['alice@example.com', 'bob@example.com'])
  })

  it('is tenant-wide when owner scope is missing or empty', () => {
    expect(
      resolveTrackingUserEmails({
        type: 'tenantApiKey',
        role: 'tenant',
        dbName: 'forge_capital_lending_db',
        tenantName: 'Forge',
        contactOwnerScope: []
      })
    ).toBeNull()

    expect(
      resolveTrackingUserEmails({
        type: 'tenantApiKey',
        role: 'tenant',
        dbName: 'forge_capital_lending_db',
        tenantName: 'Forge'
      })
    ).toBeNull()
  })
})
