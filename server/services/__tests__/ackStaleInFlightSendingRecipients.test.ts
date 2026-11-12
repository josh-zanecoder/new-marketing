import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../models/tenant/tenantClientModels', () => ({
  getTenantClientModels: vi.fn()
}))

describe('ackStaleInFlightSendingRecipients', () => {
  beforeEach(() => {
    vi.resetModules()
    delete process.env.CAMPAIGN_SEND_RECONCILE_ACK_SENDING_MS
  })

  it('marks provider-acked rows sent and releases unacked rows to pending', async () => {
    const updates: Array<{ filter: Record<string, unknown>; update: Record<string, unknown> }> = []
    const CampaignRecipient = {
      updateMany: vi.fn(async (filter: Record<string, unknown>, update: Record<string, unknown>) => {
        updates.push({ filter, update })
        return { modifiedCount: 1 }
      })
    }

    const { ackStaleInFlightSendingRecipients } = await import('../send-campaign.service')
    const n = await ackStaleInFlightSendingRecipients(
      { CampaignRecipient } as never,
      'camp-1'
    )

    expect(n).toBe(2)
    expect(updates).toHaveLength(2)
    expect(updates[0]?.update).toMatchObject({
      $set: expect.objectContaining({ status: 'sent' })
    })
    expect(updates[1]?.update).toMatchObject({
      $set: { status: 'pending' }
    })
  })
})
