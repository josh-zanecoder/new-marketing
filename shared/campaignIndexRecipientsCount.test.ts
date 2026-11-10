import { describe, expect, it } from 'vitest'
import { campaignIndexRecipientsCount } from './campaignIndexRecipientsCount'

describe('campaignIndexRecipientsCount', () => {
  it('counts ManualRecipient rows for manual and list audiences', () => {
    expect(campaignIndexRecipientsCount('manual', 3)).toBe(3)
    expect(campaignIndexRecipientsCount('list', 12)).toBe(12)
  })

  it('returns 0 when the duplicated list has no stored selection yet', () => {
    expect(campaignIndexRecipientsCount('list', 0)).toBe(0)
    expect(campaignIndexRecipientsCount('manual', 0)).toBe(0)
  })

  it('ignores unknown recipient types', () => {
    expect(campaignIndexRecipientsCount('unknown', 5)).toBe(0)
    expect(campaignIndexRecipientsCount(null, 5)).toBe(0)
  })
})
