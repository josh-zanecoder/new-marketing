import { describe, expect, it } from 'vitest'
import { parseTenantEmailSendConfig } from './resolveTenantEmailSendConfig'

describe('parseTenantEmailSendConfig', () => {
  it('defaults missing provider to Brevo', () => {
    expect(parseTenantEmailSendConfig(null)).toEqual({ provider: 'BREVO' })
    expect(parseTenantEmailSendConfig({})).toEqual({ provider: 'BREVO' })
  })

  it('resolves zcMail from the tenant registry', () => {
    const config = parseTenantEmailSendConfig({
      emailProvider: 'ZC_MAIL',
      zcMailTenant: 'acme',
      zcMailApiKey: 'zcm_tenant',
      zcMailArchive: true
    })
    expect(config).toEqual({
      provider: 'ZC_MAIL',
      apiKey: 'zcm_tenant',
      zcMailBaseUrl: 'https://apizcmail.zanecoder.com',
      zcMailTenant: 'acme',
      zcMailArchive: true
    })
  })
})
