import { describe, expect, it } from 'vitest'
import { parseRegistryZcMailFields, toTenantAdminRow } from './tenantAdminRow'

describe('parseRegistryZcMailFields', () => {
  it('defaults to Brevo when provider is unset', () => {
    const parsed = parseRegistryZcMailFields({})
    expect(parsed.emailProvider).toBe('BREVO')
    expect(parsed.zcMailArchive).toBe(true)
    expect(parsed.zcMailApiKeyConfigured).toBe(false)
  })

  it('reads zcMail fields from the registry doc', () => {
    const parsed = parseRegistryZcMailFields({
      emailProvider: 'ZC_MAIL',
      zcMailBaseUrl: 'https://apizcmail.zanecoder.com/',
      zcMailTenant: 'acme',
      zcMailArchive: false,
      zcMailApiKey: 'zcm_abcd1234efgh',
      zcMailWebhookSecret: 'whsec_abcd1234efgh'
    })
    expect(parsed.emailProvider).toBe('ZC_MAIL')
    expect(parsed.zcMailBaseUrl).toBe('https://apizcmail.zanecoder.com')
    expect(parsed.zcMailTenant).toBe('acme')
    expect(parsed.zcMailArchive).toBe(false)
    expect(parsed.zcMailApiKeyConfigured).toBe(true)
    expect(parsed.zcMailApiKeyPrefix).toBe('zcm_…efgh')
    expect(parsed.zcMailWebhookSecretConfigured).toBe(true)
    expect(parsed.zcMailWebhookSecretPrefix).toBe('whse…efgh')
  })
})

describe('toTenantAdminRow', () => {
  it('defaults campaign From address mode to default sender', () => {
    const row = toTenantAdminRow({
      name: 'Acme',
      dbName: 'acme_db',
      createdAt: '2026-01-01T00:00:00.000Z'
    })
    expect(row?.campaignFromAddressMode).toBe('default')
  })

  it('defaults allowTenantEditSender to false when unset', () => {
    const row = toTenantAdminRow({
      name: 'Acme',
      dbName: 'acme_db',
      createdAt: '2026-01-01T00:00:00.000Z'
    })
    expect(row?.allowTenantEditSender).toBe(false)
  })

  it('reads allowTenantEditSender true from the registry doc', () => {
    const row = toTenantAdminRow({
      name: 'Acme',
      dbName: 'acme_db',
      createdAt: '2026-01-01T00:00:00.000Z',
      allowTenantEditSender: true
    })
    expect(row?.allowTenantEditSender).toBe(true)
  })

  it('defaults allowTenantLoRecipientLists to false when unset', () => {
    const row = toTenantAdminRow({
      name: 'Acme',
      dbName: 'acme_db',
      createdAt: '2026-01-01T00:00:00.000Z'
    })
    expect(row?.allowTenantLoRecipientLists).toBe(false)
  })

  it('reads allowTenantLoRecipientLists true from the registry doc', () => {
    const row = toTenantAdminRow({
      name: 'Acme',
      dbName: 'acme_db',
      createdAt: '2026-01-01T00:00:00.000Z',
      allowTenantLoRecipientLists: true
    })
    expect(row?.allowTenantLoRecipientLists).toBe(true)
  })

  it('defaults allowTenantTemplateApproval to false when unset', () => {
    const row = toTenantAdminRow({
      name: 'Acme',
      dbName: 'acme_db',
      createdAt: '2026-01-01T00:00:00.000Z'
    })
    expect(row?.allowTenantTemplateApproval).toBe(false)
  })

  it('reads allowTenantTemplateApproval true from the registry doc', () => {
    const row = toTenantAdminRow({
      name: 'Acme',
      dbName: 'acme_db',
      createdAt: '2026-01-01T00:00:00.000Z',
      allowTenantTemplateApproval: true
    })
    expect(row?.allowTenantTemplateApproval).toBe(true)
  })

  it('defaults allowTenantImages to false when unset', () => {
    const row = toTenantAdminRow({
      name: 'Acme',
      dbName: 'acme_db',
      createdAt: '2026-01-01T00:00:00.000Z'
    })
    expect(row?.allowTenantImages).toBe(false)
  })

  it('reads allowTenantImages true from the registry doc', () => {
    const row = toTenantAdminRow({
      name: 'Acme',
      dbName: 'acme_db',
      createdAt: '2026-01-01T00:00:00.000Z',
      allowTenantImages: true
    })
    expect(row?.allowTenantImages).toBe(true)
  })

  it('defaults allowTenantInsertImage to false when unset', () => {
    const row = toTenantAdminRow({
      name: 'Acme',
      dbName: 'acme_db',
      createdAt: '2026-01-01T00:00:00.000Z'
    })
    expect(row?.allowTenantInsertImage).toBe(false)
  })

  it('defaults email builder flags to false when unset', () => {
    const row = toTenantAdminRow({
      name: 'Acme',
      dbName: 'acme_db',
      createdAt: '2026-01-01T00:00:00.000Z'
    })
    expect(row?.allowTenantGrapesBuilder).toBe(false)
    expect(row?.allowTenantBeefreeBuilder).toBe(false)
    expect(row?.allowTenantTemplateBuilder).toBe(false)
    expect(row?.allowTenantEditText).toBe(false)
    expect(row?.allowTenantResizeImage).toBe(false)
  })

  it('reads email builder flags from the registry doc', () => {
    const row = toTenantAdminRow({
      name: 'Acme',
      dbName: 'acme_db',
      createdAt: '2026-01-01T00:00:00.000Z',
      allowTenantGrapesBuilder: true,
      allowTenantBeefreeBuilder: true,
      allowTenantTemplateBuilder: true,
      allowTenantEditText: true,
      allowTenantResizeImage: true
    })
    expect(row?.allowTenantGrapesBuilder).toBe(true)
    expect(row?.allowTenantBeefreeBuilder).toBe(true)
    expect(row?.allowTenantTemplateBuilder).toBe(true)
    expect(row?.allowTenantEditText).toBe(true)
    expect(row?.allowTenantResizeImage).toBe(true)
  })

  it('reads allowTenantInsertImage true from the registry doc', () => {
    const row = toTenantAdminRow({
      name: 'Acme',
      dbName: 'acme_db',
      createdAt: '2026-01-01T00:00:00.000Z',
      allowTenantInsertImage: true
    })
    expect(row?.allowTenantInsertImage).toBe(true)
  })

  it('reads contact_owner From address mode from the registry doc', () => {
    const row = toTenantAdminRow({
      name: 'Acme',
      dbName: 'acme_db',
      createdAt: '2026-01-01T00:00:00.000Z',
      campaignFromAddressMode: 'contact_owner'
    })
    expect(row?.campaignFromAddressMode).toBe('contact_owner')
  })

  it('includes email provider on admin rows', () => {
    const row = toTenantAdminRow({
      name: 'Acme',
      dbName: 'acme_db',
      createdAt: '2026-01-01T00:00:00.000Z',
      emailProvider: 'ZC_MAIL',
      zcMailTenant: 'acme',
      zcMailWebhookSecret: 'secret1234abcd'
    })
    expect(row?.emailProvider).toBe('ZC_MAIL')
    expect(row?.zcMailTenant).toBe('acme')
    expect(row?.zcMailWebhookSecretConfigured).toBe(true)
    expect(row?.zcMailWebhookSecretPrefix).toBe('secr…abcd')
  })
})
