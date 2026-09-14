import { describe, expect, it } from 'vitest'
import {
  buildCrmMarketingTabUrl,
  crmMarketingPageBase,
  marketingTenantPathFromHref,
  safeMarketingTenantPath
} from './crmMarketingTabUrl'

describe('safeMarketingTenantPath', () => {
  it('keeps tenant paths with query and hash', () => {
    expect(safeMarketingTenantPath('/tenant/email-templates/add?x=1#top')).toBe(
      '/tenant/email-templates/add?x=1#top'
    )
  })

  it('rejects protocol-relative and non-tenant paths', () => {
    expect(safeMarketingTenantPath('//crm.example/tenant/dashboard')).toBe('')
    expect(safeMarketingTenantPath('/auth/login')).toBe('')
  })
})

describe('buildCrmMarketingTabUrl', () => {
  it('builds a CRM marketing URL with the iframe path', () => {
    expect(buildCrmMarketingTabUrl('https://crm.example.com/marketing', '/tenant/campaigns')).toBe(
      'https://crm.example.com/marketing?path=%2Ftenant%2Fcampaigns'
    )
  })

  it('forces /marketing even when crmAppUrl has another path', () => {
    expect(buildCrmMarketingTabUrl('https://crm.example.com/dashboard', '/tenant/contacts')).toBe(
      'https://crm.example.com/marketing?path=%2Ftenant%2Fcontacts'
    )
  })
})

describe('crmMarketingPageBase', () => {
  it('prefers crmAppUrl origin over referrer', () => {
    expect(
      crmMarketingPageBase('https://crm.example.com/app', 'https://other.example/marketing')
    ).toBe('https://crm.example.com/marketing')
  })

  it('falls back to the iframe parent referrer', () => {
    expect(
      crmMarketingPageBase('', 'https://crm-test.example/marketing', 'https://marketing.example.com')
    ).toBe('https://crm-test.example/marketing')
  })

  it('ignores a same-origin referrer after in-iframe navigation', () => {
    expect(
      crmMarketingPageBase(
        '',
        'https://marketing.example.com/auth/tenant-callback',
        'https://marketing.example.com'
      )
    ).toBe('')
  })
})

describe('marketingTenantPathFromHref', () => {
  it('reads same-origin tenant hrefs', () => {
    expect(
      marketingTenantPathFromHref(
        '/tenant/recipient-list',
        'https://marketing.example.com/tenant/dashboard'
      )
    ).toBe('/tenant/recipient-list')
  })

  it('ignores other origins', () => {
    expect(
      marketingTenantPathFromHref(
        'https://crm.example.com/marketing',
        'https://marketing.example.com'
      )
    ).toBe('')
  })
})
