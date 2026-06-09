import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  resolveCampaignSendFanoutCount,
  resolveCampaignSendFanoutTaskCount
} from '../batchTiming'

describe('batch fan-out', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('defaults fan-out to 20', () => {
    expect(resolveCampaignSendFanoutCount()).toBe(20)
  })

  it('respects CAMPAIGN_SEND_FANOUT_COUNT cap at 30', () => {
    vi.stubEnv('CAMPAIGN_SEND_FANOUT_COUNT', '25')
    expect(resolveCampaignSendFanoutCount()).toBe(25)
  })

  it('scales initial task count for small audiences', () => {
    vi.stubEnv('CAMPAIGN_SEND_FANOUT_COUNT', '20')
    expect(resolveCampaignSendFanoutTaskCount(500)).toBe(1)
    expect(resolveCampaignSendFanoutTaskCount(5000)).toBe(10)
    expect(resolveCampaignSendFanoutTaskCount(15000)).toBe(20)
  })
})
