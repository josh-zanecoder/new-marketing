import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { getMarketingPublicBaseUrl } from '../marketingPublicBaseUrl'
import { buildUnsubscribeUrl } from '../unsubscribeUrl'

vi.mock('../marketingPublicBaseUrl', () => ({
  getMarketingPublicBaseUrl: vi.fn(() => 'https://marketing.example.com')
}))

vi.mock('../unsubscribeToken', () => ({
  signUnsubscribeToken: vi.fn(() => 'signed.token')
}))

describe('buildUnsubscribeUrl', () => {
  beforeEach(() => {
    vi.mocked(getMarketingPublicBaseUrl).mockReturnValue('https://marketing.example.com')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('prefers new-marketing public API when marketing base is set', () => {
    const url = buildUnsubscribeUrl('tenant_db', 'contact1', 'secret', {
      crmAppUrl: 'https://retail.example.com/loan-officer'
    })
    expect(url).toBe(
      'https://marketing.example.com/api/v1/unsubscribe?token=signed.token'
    )
  })

  it('falls back to CRM origin so href is never empty when marketing base is unset', () => {
    vi.mocked(getMarketingPublicBaseUrl).mockReturnValue('')
    const url = buildUnsubscribeUrl('tenant_db', 'contact1', 'secret', {
      crmAppUrl: 'https://crm.example.com/deep/path'
    })
    expect(url).toBe(
      'https://crm.example.com/marketing/unsubscribe?token=signed.token'
    )
  })

  it('returns empty only when neither marketing base nor crmAppUrl is available', () => {
    vi.mocked(getMarketingPublicBaseUrl).mockReturnValue('')
    expect(buildUnsubscribeUrl('tenant_db', 'contact1', 'secret')).toBe('')
  })
})
