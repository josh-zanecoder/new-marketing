import { describe, expect, it } from 'vitest'
import {
  CAMPAIGN_RECONCILE_DEFAULT_INTERVAL_MS,
  CAMPAIGN_RECONCILE_MIN_INTERVAL_MS,
  CAMPAIGN_RECONCILE_TENANT_BATCH_DEFAULT,
  resolveCampaignReconcileIntervalMs,
  resolveCampaignReconcileTenantBatchSize
} from '../campaignReconcile'

describe('campaignReconcile constants', () => {
  it('uses a safer default interval than the old 60s hammer', () => {
    expect(CAMPAIGN_RECONCILE_DEFAULT_INTERVAL_MS).toBe(120_000)
    expect(CAMPAIGN_RECONCILE_MIN_INTERVAL_MS).toBe(60_000)
    expect(CAMPAIGN_RECONCILE_TENANT_BATCH_DEFAULT).toBe(8)
  })

  it('floors misconfigured intervals at the minimum', () => {
    expect(resolveCampaignReconcileIntervalMs(undefined)).toBe(120_000)
    expect(resolveCampaignReconcileIntervalMs('1000')).toBe(60_000)
    expect(resolveCampaignReconcileIntervalMs('180000')).toBe(180_000)
  })

  it('clamps tenant batch size', () => {
    expect(resolveCampaignReconcileTenantBatchSize(undefined)).toBe(8)
    expect(resolveCampaignReconcileTenantBatchSize('0')).toBe(8)
    expect(resolveCampaignReconcileTenantBatchSize('12')).toBe(12)
    expect(resolveCampaignReconcileTenantBatchSize('999')).toBe(50)
  })
})
