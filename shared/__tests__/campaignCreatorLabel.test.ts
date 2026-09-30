import { describe, expect, it } from 'vitest'
import { campaignCreatorLabel } from '../campaignCreatorLabel'

describe('campaignCreatorLabel', () => {
  it('prefers the creator name with the owner email', () => {
    expect(
      campaignCreatorLabel({
        ownerEmail: 'jane@example.com',
        createdBy: 'uid-1',
        creator: { firstName: 'Jane', lastName: 'Doe', email: 'other@example.com' }
      })
    ).toBe('Jane Doe · jane@example.com')
  })

  it('falls back to the snapshot email, then an email stored as createdBy', () => {
    expect(
      campaignCreatorLabel({
        creator: { firstName: 'Jane', email: 'jane@example.com' }
      })
    ).toBe('Jane · jane@example.com')
    expect(campaignCreatorLabel({ createdBy: 'jane@example.com' })).toBe('jane@example.com')
  })

  it('returns empty when no person is stored', () => {
    expect(campaignCreatorLabel({ createdBy: 'firebase-uid' })).toBe('')
    expect(campaignCreatorLabel({})).toBe('')
  })
})
