import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CampaignRecipientModel } from '@server/types/tenant/campaignRecipient.model'
import { countCampaignRecipientSent } from './countCampaignRecipientSent'

describe('countCampaignRecipientSent', () => {
  const countDocuments = vi.fn()
  const CampaignRecipient = { countDocuments } as unknown as CampaignRecipientModel

  beforeEach(() => {
    countDocuments.mockReset()
  })

  it('returns 0 for blank campaign id without querying', async () => {
    await expect(countCampaignRecipientSent(CampaignRecipient, '  ')).resolves.toBe(0)
    expect(countDocuments).not.toHaveBeenCalled()
  })

  it('counts sent recipients by campaign id string', async () => {
    countDocuments.mockResolvedValue(10)
    await expect(
      countCampaignRecipientSent(CampaignRecipient, '507f1f77bcf86cd799439011')
    ).resolves.toBe(10)
    expect(countDocuments).toHaveBeenCalledWith({
      campaign: '507f1f77bcf86cd799439011',
      status: 'sent'
    })
  })
})
