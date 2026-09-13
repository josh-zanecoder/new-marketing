import { describe, expect, it, vi, beforeEach } from 'vitest'
import { applyOneClickUnsubscribe } from './applyOneClickUnsubscribe'
import { applyMarketingUnsubscribePreference } from '@server/utils/applyMarketingUnsubscribePreference'
import { resolveUnsubscribeContext } from '@server/utils/unsubscribeRequest'
import {
  claimUnsubscribeTokenResponse,
  releaseUnsubscribeTokenClaim
} from '@server/utils/unsubscribeTokenResponse'

vi.mock('@server/utils/applyMarketingUnsubscribePreference', () => ({
  applyMarketingUnsubscribePreference: vi.fn()
}))

vi.mock('@server/utils/unsubscribeRequest', () => ({
  resolveUnsubscribeContext: vi.fn()
}))

vi.mock('@server/utils/unsubscribeTokenResponse', () => ({
  claimUnsubscribeTokenResponse: vi.fn(),
  releaseUnsubscribeTokenClaim: vi.fn()
}))

describe('applyOneClickUnsubscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ignores missing or invalid tokens without throwing', async () => {
    vi.mocked(resolveUnsubscribeContext).mockResolvedValue(null)
    await expect(applyOneClickUnsubscribe('')).resolves.toBeUndefined()
    await expect(applyOneClickUnsubscribe('bad-token')).resolves.toBeUndefined()
    expect(claimUnsubscribeTokenResponse).not.toHaveBeenCalled()
    expect(applyMarketingUnsubscribePreference).not.toHaveBeenCalled()
  })

  it('unsubscribes marketing immediately when the token is valid', async () => {
    vi.mocked(resolveUnsubscribeContext).mockResolvedValue({
      dbName: 'tenant_db',
      contactId: '507f1f77bcf86cd799439011',
      contact: {
        _id: '507f1f77bcf86cd799439011' as never,
        email: 'a@example.com',
        isUnsubscribe: false
      }
    })
    vi.mocked(claimUnsubscribeTokenResponse).mockResolvedValue({
      claimed: true,
      response: {
        tokenHash: 'hash',
        contactId: '507f1f77bcf86cd799439011',
        marketing: false,
        respondedAt: new Date()
      }
    })
    vi.mocked(applyMarketingUnsubscribePreference).mockResolvedValue({ ok: true })

    await applyOneClickUnsubscribe(' signed.token ')

    expect(claimUnsubscribeTokenResponse).toHaveBeenCalledWith({
      dbName: 'tenant_db',
      token: 'signed.token',
      contactId: '507f1f77bcf86cd799439011',
      marketing: false
    })
    expect(applyMarketingUnsubscribePreference).toHaveBeenCalledWith({
      dbName: 'tenant_db',
      contactId: '507f1f77bcf86cd799439011',
      marketing: false
    })
    expect(releaseUnsubscribeTokenClaim).not.toHaveBeenCalled()
  })

  it('does not overwrite an already-claimed token or already-unsubscribed contact', async () => {
    vi.mocked(resolveUnsubscribeContext).mockResolvedValue({
      dbName: 'tenant_db',
      contactId: '507f1f77bcf86cd799439011',
      contact: {
        _id: '507f1f77bcf86cd799439011' as never,
        email: 'a@example.com',
        isUnsubscribe: true
      }
    })
    await applyOneClickUnsubscribe('signed.token')
    expect(claimUnsubscribeTokenResponse).not.toHaveBeenCalled()

    vi.mocked(resolveUnsubscribeContext).mockResolvedValue({
      dbName: 'tenant_db',
      contactId: '507f1f77bcf86cd799439011',
      contact: {
        _id: '507f1f77bcf86cd799439011' as never,
        email: 'a@example.com',
        isUnsubscribe: false
      }
    })
    vi.mocked(claimUnsubscribeTokenResponse).mockResolvedValue({
      claimed: false,
      response: {
        tokenHash: 'hash',
        contactId: '507f1f77bcf86cd799439011',
        marketing: false,
        respondedAt: new Date()
      }
    })
    await applyOneClickUnsubscribe('signed.token')
    expect(applyMarketingUnsubscribePreference).not.toHaveBeenCalled()
  })
})
