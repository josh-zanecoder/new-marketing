import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FlyerModel } from '@server/types/tenant/flyer.model'

vi.mock('@server/services/customMarketingImageUpload.service', () => ({
  deleteCustomMarketingTenantImages: vi.fn()
}))

import { deleteCustomMarketingTenantImages } from '@server/services/customMarketingImageUpload.service'
import { hardDeleteSoftDeletedFlyer } from '../hardDeleteFlyer'

describe('hardDeleteSoftDeletedFlyer', () => {
  const findById = vi.fn()
  const deleteOne = vi.fn()
  const Flyer = {
    findById,
    deleteOne
  } as unknown as FlyerModel

  beforeEach(() => {
    findById.mockReset()
    deleteOne.mockReset()
    vi.mocked(deleteCustomMarketingTenantImages).mockReset()
  })

  it('returns not_found when flyer is missing', async () => {
    findById.mockReturnValue({
      select: () => ({
        lean: async () => null
      })
    })

    await expect(
      hardDeleteSoftDeletedFlyer({
        Flyer,
        flyerId: '507f1f77bcf86cd799439011',
        tenantFolderName: 'Acme'
      })
    ).resolves.toEqual({ ok: false, reason: 'not_found' })
    expect(deleteOne).not.toHaveBeenCalled()
  })

  it('refuses hard delete when flyer is still active', async () => {
    findById.mockReturnValue({
      select: () => ({
        lean: async () => ({
          _id: '507f1f77bcf86cd799439011',
          deletedAt: null,
          objectPath: 'custom-marketing/Acme/flyers/a.pdf'
        })
      })
    })

    await expect(
      hardDeleteSoftDeletedFlyer({
        Flyer,
        flyerId: '507f1f77bcf86cd799439011',
        tenantFolderName: 'Acme'
      })
    ).resolves.toEqual({ ok: false, reason: 'not_soft_deleted' })
    expect(deleteOne).not.toHaveBeenCalled()
  })

  it('deletes GCS object then Mongo doc for soft-deleted flyer', async () => {
    findById.mockReturnValue({
      select: () => ({
        lean: async () => ({
          _id: '507f1f77bcf86cd799439011',
          deletedAt: new Date('2026-11-20T00:00:00.000Z'),
          objectPath: 'custom-marketing/Acme/flyers/a.pdf'
        })
      })
    })
    vi.mocked(deleteCustomMarketingTenantImages).mockResolvedValue({
      deleted: ['custom-marketing/Acme/flyers/a.pdf'],
      skipped: []
    })
    deleteOne.mockResolvedValue({ deletedCount: 1 })

    await expect(
      hardDeleteSoftDeletedFlyer({
        Flyer,
        flyerId: '507f1f77bcf86cd799439011',
        tenantFolderName: 'Acme'
      })
    ).resolves.toEqual({ ok: true, gcsDeleted: true })

    expect(deleteCustomMarketingTenantImages).toHaveBeenCalledWith(
      'Acme',
      ['custom-marketing/Acme/flyers/a.pdf'],
      { ownerEmails: null }
    )
    expect(deleteOne).toHaveBeenCalledWith({
      _id: '507f1f77bcf86cd799439011',
      deletedAt: { $ne: null }
    })
  })
})
