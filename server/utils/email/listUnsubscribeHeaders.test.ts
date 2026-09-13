import { describe, expect, it, vi, beforeEach } from 'vitest'
import { getMarketingPublicBaseUrl } from '../marketingPublicBaseUrl'
import {
  buildListUnsubscribeHeaders,
  listUnsubscribeHeadersForContact
} from './listUnsubscribeHeaders'

vi.mock('../marketingPublicBaseUrl', () => ({
  getMarketingPublicBaseUrl: vi.fn(() => 'https://marketing.example.com')
}))

vi.mock('../unsubscribeToken', () => ({
  signUnsubscribeToken: vi.fn(() => 'signed.token')
}))

describe('buildListUnsubscribeHeaders', () => {
  beforeEach(() => {
    vi.mocked(getMarketingPublicBaseUrl).mockReturnValue('https://marketing.example.com')
  })

  it('returns RFC 8058 headers for an https one-click URL', () => {
    expect(
      buildListUnsubscribeHeaders(
        'https://marketing.example.com/api/v1/unsubscribe/one-click?token=abc'
      )
    ).toEqual({
      'List-Unsubscribe':
        '<https://marketing.example.com/api/v1/unsubscribe/one-click?token=abc>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
    })
  })

  it('omits headers when the URL is empty, http, or not https', () => {
    expect(buildListUnsubscribeHeaders('')).toBeUndefined()
    expect(buildListUnsubscribeHeaders('javascript:alert(1)')).toBeUndefined()
    expect(
      buildListUnsubscribeHeaders(
        'http://marketing.example.com/api/v1/unsubscribe/one-click?token=abc'
      )
    ).toBeUndefined()
  })

  it('builds per-contact headers when marketing public base is set', () => {
    expect(
      listUnsubscribeHeadersForContact({
        dbName: 'tenant_db',
        contactId: 'contact1',
        clientKeyHash: 'secret'
      })
    ).toEqual({
      'List-Unsubscribe':
        '<https://marketing.example.com/api/v1/unsubscribe/one-click?token=signed.token>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
    })
  })

  it('omits per-contact headers when marketing public base or contact is missing', () => {
    vi.mocked(getMarketingPublicBaseUrl).mockReturnValue('')
    expect(
      listUnsubscribeHeadersForContact({
        dbName: 'tenant_db',
        contactId: 'contact1',
        clientKeyHash: 'secret'
      })
    ).toBeUndefined()
    vi.mocked(getMarketingPublicBaseUrl).mockReturnValue('https://marketing.example.com')
    expect(
      listUnsubscribeHeadersForContact({
        dbName: 'tenant_db',
        clientKeyHash: 'secret'
      })
    ).toBeUndefined()
  })
})
