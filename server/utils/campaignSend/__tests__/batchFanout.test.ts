import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  resolveCampaignSendFanoutCount,
  resolveCampaignSendFanoutTaskCount
} from '../batchTiming'

describe('batch fan-out', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('defaults fan-out to 30', () => {
    expect(resolveCampaignSendFanoutCount()).toBe(30)
  })

  it('respects CAMPAIGN_SEND_FANOUT_COUNT up to 50', () => {
    vi.stubEnv('CAMPAIGN_SEND_FANOUT_COUNT', '40')
    expect(resolveCampaignSendFanoutCount()).toBe(40)
  })

  it('scales initial task count for small audiences', () => {
    vi.stubEnv('CAMPAIGN_SEND_FANOUT_COUNT', '30')
    expect(resolveCampaignSendFanoutTaskCount(500)).toBe(1)
    expect(resolveCampaignSendFanoutTaskCount(5000)).toBe(10)
    expect(resolveCampaignSendFanoutTaskCount(15001)).toBe(30)
  })
})
