import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  resolveCampaignSendRecipientDelayMs,
  sleepCampaignSendRecipientDelayIfConfigured
} from '../batchTiming'

describe('batchTiming recipient delay', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('prefers CAMPAIGN_SEND_RECIPIENT_DELAY_MS', () => {
    vi.stubEnv('CAMPAIGN_SEND_RECIPIENT_DELAY_MS', '1500')
    vi.stubEnv('CAMPAIGN_SEND_BATCH_DELAY_MS', '999')
    expect(resolveCampaignSendRecipientDelayMs()).toBe(1500)
  })

  it('falls back to CAMPAIGN_SEND_BATCH_DELAY_MS', () => {
    vi.stubEnv('CAMPAIGN_SEND_RECIPIENT_DELAY_MS', '')
    vi.stubEnv('CAMPAIGN_SEND_BATCH_DELAY_MS', '2000')
    expect(resolveCampaignSendRecipientDelayMs()).toBe(2000)
  })

  it('returns 0 when unset', () => {
    vi.stubEnv('CAMPAIGN_SEND_RECIPIENT_DELAY_MS', '')
    vi.stubEnv('CAMPAIGN_SEND_BATCH_DELAY_MS', '')
    expect(resolveCampaignSendRecipientDelayMs()).toBe(0)
  })

  it('sleeps when delay is configured', async () => {
    vi.stubEnv('CAMPAIGN_SEND_RECIPIENT_DELAY_MS', '10')
    vi.useFakeTimers()
    const promise = sleepCampaignSendRecipientDelayIfConfigured()
    await vi.advanceTimersByTimeAsync(10)
    await expect(promise).resolves.toBe(10)
    vi.useRealTimers()
  })
})
