import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  campaignRequiresPerRecipientMerge,
  resolveCampaignSendBatchSizeForContent,
  resolvePersonalizedCampaignBatchSize,
  resolveUniformCampaignBatchSize
} from '../campaignBatchSize'

describe('campaignBatchSize', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('detects merge tags as personalized', () => {
    expect(campaignRequiresPerRecipientMerge('Hi {{contact.firstName}}', '<p>x</p>', [])).toBe(true)
    expect(campaignRequiresPerRecipientMerge('Hi', '<p>static</p>', [])).toBe(false)
  })

  it('uses uniform size for static blast content', () => {
    vi.stubEnv('CAMPAIGN_SEND_BATCH_SIZE_UNIFORM', '500')
    expect(
      resolveCampaignSendBatchSizeForContent('Subject', '<p>Hello</p>', [])
    ).toBe(500)
  })

  it('uses personalized size when merge tags present', () => {
    vi.stubEnv('CAMPAIGN_SEND_BATCH_SIZE_PERSONALIZED', '200')
    expect(
      resolveCampaignSendBatchSizeForContent('Hi {{user.firstName}}', '<p>x</p>', [])
    ).toBe(200)
  })

  it('respects env overrides', () => {
    vi.stubEnv('CAMPAIGN_SEND_BATCH_SIZE_UNIFORM', '400')
    vi.stubEnv('CAMPAIGN_SEND_BATCH_SIZE_PERSONALIZED', '150')
    expect(resolveUniformCampaignBatchSize()).toBe(400)
    expect(resolvePersonalizedCampaignBatchSize()).toBe(150)
  })
})
