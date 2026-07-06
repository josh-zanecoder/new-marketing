import { describe, expect, it } from 'vitest'
import {
  estimateBrevoBytesPerPersonalizedRecipient,
  resolveCampaignSendBatchSize
} from '../resolveCampaignSendBatchSize'
import { CAMPAIGN_SEND_BATCH_SIZE as MAX_BATCH } from '../constants'

describe('resolveCampaignSendBatchSize', () => {
  it('keeps the default batch size for small templates', () => {
    const html = '<p>Hello {{recipient.firstName}}</p>'
    expect(resolveCampaignSendBatchSize(html)).toBe(MAX_BATCH)
  })

  it('reduces batch size for large personalized HTML templates', () => {
    const largeHtml = '<div>' + 'x'.repeat(40_000) + '</div>'
    const size = resolveCampaignSendBatchSize(largeHtml)
    expect(size).toBeLessThan(MAX_BATCH)
    expect(size).toBeGreaterThanOrEqual(1)
  })

  it('estimates non-uniform payload as roughly 2x html per recipient', () => {
    expect(estimateBrevoBytesPerPersonalizedRecipient(10_000)).toBe(20_600)
  })
})
