import { describe, expect, it, beforeEach } from 'vitest'
import {
  resetCampaignReconcileGateForTests,
  withCampaignReconcileGate
} from '../campaignReconcileGate'

describe('withCampaignReconcileGate', () => {
  beforeEach(() => {
    resetCampaignReconcileGateForTests()
  })

  it('runs the callback when the gate is free', async () => {
    const result = await withCampaignReconcileGate('SendingReconcile', async () => 42)
    expect(result).toBe(42)
  })

  it('skips when another reconcile holds the gate', async () => {
    let release!: () => void
    const held = new Promise<void>((resolve) => {
      release = resolve
    })

    const first = withCampaignReconcileGate('SendingReconcile', async () => {
      await held
      return 'first'
    })

    await Promise.resolve()
    const second = await withCampaignReconcileGate('ScheduleReconcile', async () => 'second')
    expect(second).toBeUndefined()

    release()
    await expect(first).resolves.toBe('first')
  })
})
