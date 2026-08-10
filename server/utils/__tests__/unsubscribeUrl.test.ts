import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../marketingPublicBaseUrl', () => ({
  getMarketingPublicBaseUrl: vi.fn(() => 'https://marketing.example.com')
}))

vi.mock('../unsubscribeToken', () => ({
  signUnsubscribeToken: vi.fn(() => 'signed.token')
}))

import { getMarketingPublicBaseUrl } from '../marketingPublicBaseUrl'
import { buildUnsubscribeUrl } from '../unsubscribeUrl'

describe('buildUnsubscribeUrl', () => {
  beforeEach(() => {
    vi.mocked(getMarketingPublicBaseUrl).mockReturnValue('https://marketing.example.com')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('fills {{unsubscribe}} with new-marketing public API even when crmAppUrl is set', () => {
    const url = buildUnsubscribeUrl('tenant_db', 'contact1', 'secret', {
      crmAppUrl: 'https://retail.example.com/loan-officer'
    })
    expect(url).toBe(
      'https://marketing.example.com/api/v1/unsubscribe?token=signed.token'
    )
  })

  it('returns empty when marketing public base is unset', () => {
    vi.mocked(getMarketingPublicBaseUrl).mockReturnValue('')
    expect(buildUnsubscribeUrl('tenant_db', 'contact1', 'secret')).toBe('')
  })
})
