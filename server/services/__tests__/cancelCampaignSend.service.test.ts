import { describe, expect, it, vi, beforeEach } from 'vitest'
import { CAMPAIGN_RECIPIENT_STATUS_PENDING } from '../../utils/campaignSend/constants'

vi.stubGlobal(
  'createError',
  (err: { statusCode: number; message: string }) =>
    Object.assign(new Error(err.message), { statusCode: err.statusCode })
)

vi.mock('../../queue/emailQueue', () => ({
  removeCampaignBatchJobs: vi.fn(async () => 0)
}))

describe('stopCampaignSend recipient updates', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('only cancels pending rows, not sending', async () => {
    const updateMany = vi.fn(async () => ({ matchedCount: 1, modifiedCount: 1 }))
    let findByIdCalls = 0
    const CampaignRecipient = {
      updateMany,
      aggregate: vi.fn(() => ({
        exec: async () => []
      })),
      find: vi.fn(() => ({
        sort: () => ({
          limit: () => ({
            select: () => ({
              lean: async () => []
            })
          })
        })
      }))
    }
    const Campaign = {
      findById: vi.fn(() => ({
        select: () => ({
          lean: async () => {
            findByIdCalls += 1
            if (findByIdCalls === 1) {
              return { status: 'Sending', sendRunId: 'run-1', name: 'Test' }
            }
            return {
              status: 'Paused',
              sendRunId: 'run-2',
              name: 'Test',
              subject: 'Hi',
              sender: { email: 's@test.com', name: 'S' },
              metadata: {},
              createdBy: 'u1',
              updatedAt: new Date()
            }
          }
        })
      })),
      updateOne: vi.fn(async () => ({ matchedCount: 1 }))
    }

    const { stopCampaignSend } = await import('../cancelCampaignSend.service')

    await stopCampaignSend(
      { Campaign, CampaignRecipient } as never,
      '507f1f77bcf86cd799439011',
      {
        tenantDbName: 'tenant_db',
        tenantName: 'Tenant',
        outcome: 'pause'
      }
    )

    expect(updateMany).toHaveBeenCalledWith(
      {
        campaign: '507f1f77bcf86cd799439011',
        status: CAMPAIGN_RECIPIENT_STATUS_PENDING
      },
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'cancelled' })
      })
    )
  })
})
