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
      zcMailApiKey: 'zcm_abcd1234efgh'
    })
    expect(parsed.emailProvider).toBe('ZC_MAIL')
    expect(parsed.zcMailBaseUrl).toBe('https://apizcmail.zanecoder.com')
    expect(parsed.zcMailTenant).toBe('acme')
    expect(parsed.zcMailArchive).toBe(false)
    expect(parsed.zcMailApiKeyConfigured).toBe(true)
    expect(parsed.zcMailApiKeyPrefix).toBe('zcm_…efgh')
  })
})

describe('toTenantAdminRow', () => {
  it('includes email provider on admin rows', () => {
    const row = toTenantAdminRow({
      name: 'Acme',
      dbName: 'acme_db',
      createdAt: '2026-01-01T00:00:00.000Z',
      emailProvider: 'ZC_MAIL',
      zcMailTenant: 'acme'
    })
    expect(row?.emailProvider).toBe('ZC_MAIL')
    expect(row?.zcMailTenant).toBe('acme')
  })
})
