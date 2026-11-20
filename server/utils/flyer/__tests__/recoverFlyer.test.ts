import { beforeEach, describe, expect, it, vi } from 'vitest'
import { recoverSoftDeletedFlyer } from '../recoverFlyer'
import type { FlyerModel } from '@server/types/tenant/flyer.model'

describe('recoverSoftDeletedFlyer', () => {
  const findById = vi.fn()
  const updateOne = vi.fn()
  const Flyer = {
    findById,
    updateOne
  } as unknown as FlyerModel

  beforeEach(() => {
    findById.mockReset()
    updateOne.mockReset()
  })

  it('returns not_found when flyer is missing', async () => {
    findById.mockReturnValue({
      select: () => ({
        lean: async () => null
      })
    })

    await expect(recoverSoftDeletedFlyer(Flyer, '507f1f77bcf86cd799439011')).resolves.toEqual({
      ok: false,
      reason: 'not_found'
    })
    expect(updateOne).not.toHaveBeenCalled()
  })

  it('returns alreadyActive when deletedAt is null', async () => {
    findById.mockReturnValue({
      select: () => ({
        lean: async () => ({
          _id: '507f1f77bcf86cd799439011',
          deletedAt: null
        })
      })
    })

    await expect(recoverSoftDeletedFlyer(Flyer, '507f1f77bcf86cd799439011')).resolves.toEqual({
      ok: true,
      alreadyActive: true
    })
    expect(updateOne).not.toHaveBeenCalled()
  })

  it('clears deletedAt for a soft-deleted flyer', async () => {
    findById.mockReturnValue({
      select: () => ({
        lean: async () => ({
          _id: '507f1f77bcf86cd799439011',
          deletedAt: new Date('2026-11-20T00:00:00.000Z')
        })
      })
    })
    updateOne.mockResolvedValue({ modifiedCount: 1 })

    await expect(recoverSoftDeletedFlyer(Flyer, '507f1f77bcf86cd799439011')).resolves.toEqual({
      ok: true,
      alreadyActive: false
    })

    expect(updateOne).toHaveBeenCalledWith(
      {
        _id: '507f1f77bcf86cd799439011',
        deletedAt: { $ne: null }
      },
      {
        $set: { deletedAt: null }
      }
    )
  })
})
