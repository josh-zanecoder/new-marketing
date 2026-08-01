import { describe, expect, it } from 'vitest'
import {
  mergeTrackingUserEmails,
  resolveTrackingUserEmails,
  resolveTrackingUserScope
} from './resolveTrackingTenantContext'

describe('resolveTrackingUserScope', () => {
  it('is unrestricted with optional filter for non API-key auth', () => {
    expect(resolveTrackingUserScope({ role: 'tenant', dbName: 'x' })).toEqual({
      ownerEmails: null,
      allowUserTagFilter: true
    })
  })

  it('allows optional user tag filter when tenantWideContacts is set', () => {
    expect(
      resolveTrackingUserScope({
        type: 'tenantApiKey',
        role: 'tenant',
        dbName: 'forge_capital_lending_db',
        tenantName: 'Forge',
        tenantWideContacts: true,
        contactOwnerScope: ['alice@example.com']
      })
    ).toEqual({
      ownerEmails: null,
      allowUserTagFilter: true
    })
  })

  it('returns owner scope emails and allows filter when more than one owner', () => {
    expect(
      resolveTrackingUserScope({
        type: 'tenantApiKey',
        role: 'tenant',
        dbName: 'forge_capital_lending_db',
        tenantName: 'Forge',
        contactOwnerScope: ['Alice@Example.com', 'bob@example.com', 'alice@example.com']
      })
    ).toEqual({
      ownerEmails: ['alice@example.com', 'bob@example.com'],
      allowUserTagFilter: true
    })
  })

  it('keeps forced ownership without optional filter for a single owner', () => {
    expect(
      resolveTrackingUserScope({
        type: 'tenantApiKey',
        role: 'tenant',
        dbName: 'forge_capital_lending_db',
        tenantName: 'Forge',
        contactOwnerScope: ['alice@example.com']
      })
    ).toEqual({
      ownerEmails: ['alice@example.com'],
      allowUserTagFilter: false
    })
  })

  it('is unrestricted when owner scope is missing or empty', () => {
    expect(
      resolveTrackingUserScope({
        type: 'tenantApiKey',
        role: 'tenant',
        dbName: 'forge_capital_lending_db',
        tenantName: 'Forge',
        contactOwnerScope: []
      })
    ).toEqual({
      ownerEmails: null,
      allowUserTagFilter: true
    })

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

describe('mergeTrackingUserEmails', () => {
  it('keeps forced ownership and ignores client filter when not allowed', () => {
    expect(
      mergeTrackingUserEmails(['alice@example.com', 'bob@example.com'], 'eve@example.com', false)
    ).toEqual({
      ownershipEmails: ['alice@example.com', 'bob@example.com'],
      filterEmails: null
    })
  })

  it('narrows forced ownership to an in-scope requested user', () => {
    expect(
      mergeTrackingUserEmails(
        ['alice@example.com', 'bob@example.com'],
        'bob@example.com',
        true
      )
    ).toEqual({
      ownershipEmails: ['bob@example.com'],
      filterEmails: null
    })
  })

  it('does not widen forced ownership past the session scope', () => {
    expect(
      mergeTrackingUserEmails(
        ['alice@example.com', 'bob@example.com'],
        'eve@example.com',
        true
      )
    ).toEqual({
      ownershipEmails: ['alice@example.com', 'bob@example.com'],
      filterEmails: null
    })
  })

  it('applies optional filter for tenant-wide sessions', () => {
    expect(mergeTrackingUserEmails(null, 'ops@example.com', true)).toEqual({
      ownershipEmails: null,
      filterEmails: ['ops@example.com']
    })
  })

  it('ignores optional filter when not allowed', () => {
    expect(mergeTrackingUserEmails(null, 'ops@example.com', false)).toEqual({
      ownershipEmails: null,
      filterEmails: null
    })
  })
})
