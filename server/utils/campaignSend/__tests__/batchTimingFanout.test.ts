import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  resolveCampaignSendFanoutCount,
  resolveCampaignSendFanoutTaskCount,
  resolveCampaignSendReplenishPageCount,
  resolveCampaignSendReplenishPages
} from '../batchTiming'
import { CAMPAIGN_SEND_FANOUT_DEFAULT } from '../constants'

describe('batchTiming fanout', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('defaults fanout to 30 for 15k uniform coverage in one wave', () => {
    vi.unstubAllEnvs()
    expect(CAMPAIGN_SEND_FANOUT_DEFAULT).toBe(30)
    expect(resolveCampaignSendFanoutCount()).toBe(30)
  })

  it('enqueues 30 tasks for a 15k audience at start', () => {
    expect(resolveCampaignSendFanoutTaskCount(15001)).toBe(30)
  })

  it('replenish pages scale with remaining outstanding work', () => {
    vi.stubEnv('CAMPAIGN_SEND_FANOUT_COUNT', '30')
    expect(resolveCampaignSendReplenishPageCount(15000)).toBe(30)
    expect(resolveCampaignSendReplenishPageCount(2500)).toBe(5)
    expect(resolveCampaignSendReplenishPageCount(0)).toBe(0)
  })

  it('replenish pages start at page + fanout', () => {
    vi.stubEnv('CAMPAIGN_SEND_FANOUT_COUNT', '30')
    expect(resolveCampaignSendReplenishPages(4, 6000)).toEqual([
      34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45
    ])
  })
})
