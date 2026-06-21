import { describe, expect, it } from 'vitest'
import {
  campaignSenderDisplayNameFromAuth,
  resolveCampaignSenderForPersistence
} from '../campaignSenderFromAuth'

describe('campaignSenderDisplayNameFromAuth', () => {
  it('uses first and last name from tenant session', () => {
    expect(
      campaignSenderDisplayNameFromAuth({
        type: 'tenantApiKey',
        role: 'tenant',
        tenantName: 'Acme',
        dbName: 'acme',
        tenantUserFirstName: 'John',
        tenantUserLastName: 'Dick',
        tenantUserEmail: 'john@example.com'
      })
    ).toBe('John Dick')
  })

  it('falls back to forwarded display name', () => {
    expect(
      campaignSenderDisplayNameFromAuth({
        type: 'tenantApiKey',
        role: 'tenant',
        tenantName: 'Acme',
        dbName: 'acme',
        tenantUserName: 'John Dick'
      })
    ).toBe('John Dick')
  })
})

describe('resolveCampaignSenderForPersistence', () => {
  it('prefers session name and admin email fallback', () => {
    expect(
      resolveCampaignSenderForPersistence(
        {
          type: 'tenantApiKey',
          role: 'tenant',
          tenantName: 'Acme',
          dbName: 'acme',
          tenantUserFirstName: 'John',
          tenantUserLastName: 'Dick'
        },
        { name: 'Forge Capital Lending', email: 'marketing@example.com' },
        { senderEmail: 'marketing@example.com' }
      )
    ).toEqual({
      name: 'John Dick',
      email: 'marketing@example.com'
    })
  })

  it('uses admin default name when session has no operator name', () => {
    expect(
      resolveCampaignSenderForPersistence(
        {
          type: 'tenantApiKey',
          role: 'tenant',
          tenantName: 'Acme',
          dbName: 'acme'
        },
        { name: 'Forge Capital Lending', email: 'marketing@example.com' }
      )
    ).toEqual({
      name: 'Forge Capital Lending',
      email: 'marketing@example.com'
    })
  })
})
