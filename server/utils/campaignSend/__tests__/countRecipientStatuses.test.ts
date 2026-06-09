import { describe, expect, it } from 'vitest'
import { countRecipientStatuses } from '../countRecipientStatuses'

describe('countRecipientStatuses', () => {
  it('aggregates pending, sending, sent, and failed in one pass', async () => {
    const CampaignRecipient = {
      aggregate: async () => [
        { _id: 'pending', count: 10 },
        { _id: 'sending', count: 2 },
        { _id: 'sent', count: 100 },
        { _id: 'failed', count: 3 }
      ]
    }

    const counts = await countRecipientStatuses(CampaignRecipient as never, 'c1')
    expect(counts).toEqual({ pending: 12, sent: 100, failed: 3 })
  })
})
