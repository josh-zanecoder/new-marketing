import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@server/utils/auth/marketingAudienceFromAuth', () => ({
  marketingAudienceOwnerEmailsFromAuth: () => null // OM/Marketing tenant-wide
}))

vi.mock('@server/utils/emailMerge/tenantUserFromAuth', () => ({
  tenantUserFieldsFromAuth: () => ({
    email: 'marketing.user@zanecoder.com',
    firstName: 'Marketing',
    lastName: 'User'
  })
}))

vi.mock('@server/tenant/registry-auth', async () => {
  const actual = await vi.importActual<typeof import('@server/tenant/registry-auth')>(
    '@server/tenant/registry-auth'
  )
  return {
    ...actual,
    tenantUserEmailFromAuth: () => 'marketing.user@zanecoder.com'
  }
})

import { listCampaignSenderCandidates } from '../listCampaignSenderCandidates'
import { resolveTypedCampaignSenderName } from '~~/shared/resolveTypedCampaignSenderName'

describe('OM/Marketing type hello+sistarlo@ → first+last Sender name', () => {
  const loEmail = 'hello+sistarlo@zanecoder.com'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exact email lookup returns John Broker (live CRM shape) for Marketing/OM typed sender', async () => {
    const aggregate = vi.fn(async (pipeline: unknown[]) => {
      // Exact @ query must use $eq on owner email (plus-safe).
      const match = pipeline[0] as { $match?: { $and?: unknown[] } }
      const and = match?.$match?.$and ?? []
      const hasExactEq = JSON.stringify(and).includes(loEmail)
      expect(hasExactEq).toBe(true)
      // Matches marketing_db: 53 borrowers owned by hello+sistarlo with ownerFirst/Last.
      return [
        {
          _id: loEmail,
          firstName: 'John',
          lastName: 'Broker',
          avatarUrl: ''
        }
      ]
    })
    const find = vi.fn(() => ({
      select: () => ({
        lean: async () => []
      })
    }))

    const Contact = { aggregate, find } as never
    const auth = { dbName: 'test' } as never

    const candidates = await listCampaignSenderCandidates(Contact, auth, {
      q: loEmail,
      limit: 12
    })

    expect(candidates).toHaveLength(1)
    expect(candidates[0]).toMatchObject({
      email: loEmail,
      firstName: 'John',
      lastName: 'Broker',
      displayName: 'John Broker'
    })

    // What Marketing/OM campaign UI does after typing the LO email:
    const senderName = resolveTypedCampaignSenderName({
      senderEmail: loEmail,
      defaultDisplayName: 'Forge Capital Lending',
      sessionEmail: 'marketing.user@zanecoder.com',
      sessionDisplayName: 'Marketing User',
      matchedCandidateDisplayName: candidates[0]!.displayName
    })
    expect(senderName).toBe('John Broker')
    expect(senderName).not.toBe(loEmail)
    expect(senderName).not.toBe('Marketing User')
    expect(senderName).not.toBe('Forge Capital Lending')
  })

  it('when owner metadata names empty, enriches from LO contact profile first+last', async () => {
    const aggregate = vi.fn(async () => [
      {
        _id: loEmail,
        firstName: '',
        lastName: '',
        avatarUrl: ''
      }
    ])
    const find = vi.fn(() => ({
      select: () => ({
        lean: async () => [
          {
            email: loEmail,
            firstName: 'John',
            lastName: 'Broker'
          }
        ]
      })
    }))

    const candidates = await listCampaignSenderCandidates(
      { aggregate, find } as never,
      { dbName: 'test' } as never,
      { q: loEmail }
    )

    expect(candidates[0]?.displayName).toBe('John Broker')
  })
})
