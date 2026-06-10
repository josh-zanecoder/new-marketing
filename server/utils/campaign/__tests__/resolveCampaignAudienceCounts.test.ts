import { describe, expect, it } from 'vitest'
import { buildRecipientStatusCountsMap } from '@server/utils/campaignSend/recipientStatusCounts'

describe('resolveCampaignAudienceCounts helpers', () => {
  it('buildRecipientStatusCountsMap totals sent snapshot rows', () => {
    const campaignId = '507f1f77bcf86cd799439011'
    const map = buildRecipientStatusCountsMap([campaignId], [
      { campaignId, status: 'sent', count: 12000 },
      { campaignId, status: 'pending', count: 2000 },
      { campaignId, status: 'failed', count: 1 }
    ])
    const counts = map.get(campaignId)
    expect(counts?.total).toBe(14001)
    expect(counts?.sent).toBe(12000)
    expect(counts?.pending).toBe(2000)
  })
})
