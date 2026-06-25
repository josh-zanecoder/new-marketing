import { describe, expect, it } from 'vitest'
import { resolveCampaignSenderForPersistence } from '../campaignSenderFromAuth'

describe('resolveCampaignSenderForPersistence', () => {
  it('uses admin default name and body email', () => {
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
      name: 'Forge Capital Lending',
      email: 'marketing@example.com'
    })
  })

  it('ignores session operator name for stored sender', () => {
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
        { name: 'Forge Capital Lending', email: 'marketing@example.com' }
      )
    ).toEqual({
      name: 'Forge Capital Lending',
      email: 'marketing@example.com'
    })
  })
})
