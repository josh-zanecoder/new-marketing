import { describe, expect, it } from 'vitest'
import { resolveCampaignSenderForPersistence } from '../campaignSenderFromAuth'

const defaults = {
  name: 'Forge Capital Lending',
  email: 'marketing@example.com',
  allowTenantEditSender: false
}

const auth = {
  type: 'tenantApiKey' as const,
  role: 'tenant' as const,
  tenantName: 'Acme',
  dbName: 'acme'
}

describe('resolveCampaignSenderForPersistence', () => {
  it('OFF: keeps body email when present (preserves custom From on edit)', () => {
    expect(
      resolveCampaignSenderForPersistence(
        auth,
        defaults,
        { senderEmail: 'custom@example.com', senderName: 'Ignored' },
        { allowTenantEditSender: false }
      )
    ).toEqual({
      name: 'Forge Capital Lending',
      email: 'custom@example.com',
      senderMode: 'contact_owner'
    })
  })

  it('OFF: falls back to registry default email when body email omitted', () => {
    expect(
      resolveCampaignSenderForPersistence(auth, defaults, {}, { allowTenantEditSender: false })
    ).toEqual({
      name: 'Forge Capital Lending',
      email: 'marketing@example.com',
      senderMode: 'contact_owner'
    })
  })

  it('ON without selected mode: stays contact_owner (toggle alone does not lock LO From)', () => {
    expect(
      resolveCampaignSenderForPersistence(
        auth,
        { ...defaults, allowTenantEditSender: true },
        { senderEmail: 'lo@example.com', senderName: 'Jane Loan Officer' },
        { allowTenantEditSender: true }
      )
    ).toEqual({
      name: 'Forge Capital Lending',
      email: 'lo@example.com',
      senderMode: 'contact_owner'
    })
  })

  it('ON with selected mode: stores LO name + email', () => {
    expect(
      resolveCampaignSenderForPersistence(
        auth,
        { ...defaults, allowTenantEditSender: true },
        {
          senderEmail: 'lo@example.com',
          senderName: 'Jane Loan Officer',
          senderMode: 'selected'
        },
        { allowTenantEditSender: true }
      )
    ).toEqual({
      name: 'Jane Loan Officer',
      email: 'lo@example.com',
      senderMode: 'selected'
    })
  })

  it('ON with selected mode: replaces Contact owner placeholder with email', () => {
    expect(
      resolveCampaignSenderForPersistence(
        auth,
        { ...defaults, allowTenantEditSender: true },
        {
          senderEmail: 'lo@example.com',
          senderName: 'Contact owner',
          senderMode: 'selected'
        },
        { allowTenantEditSender: true }
      )
    ).toEqual({
      name: 'lo@example.com',
      email: 'lo@example.com',
      senderMode: 'selected'
    })
  })

  it('OFF ignores selected mode in body', () => {
    expect(
      resolveCampaignSenderForPersistence(
        auth,
        defaults,
        {
          senderEmail: 'lo@example.com',
          senderName: 'Jane Loan Officer',
          senderMode: 'selected'
        },
        { allowTenantEditSender: false }
      )
    ).toEqual({
      name: 'Forge Capital Lending',
      email: 'lo@example.com',
      senderMode: 'contact_owner'
    })
  })
})
