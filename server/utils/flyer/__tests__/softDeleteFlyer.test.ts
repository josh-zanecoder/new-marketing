import { beforeEach, describe, expect, it, vi } from 'vitest'
import { softDeleteFlyerById } from '../softDeleteFlyer'
import type { FlyerModel } from '@server/types/tenant/flyer.model'

describe('softDeleteFlyerById', () => {
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

  it('returns not matched when flyer is missing', async () => {
    findById.mockReturnValue({
      select: () => ({
        lean: async () => null
      })
    })

    await expect(softDeleteFlyerById(Flyer, '507f1f77bcf86cd799439011')).resolves.toEqual({
      matched: false,
      alreadyDeleted: false
    })
    expect(updateOne).not.toHaveBeenCalled()
  })

  it('returns alreadyDeleted when deletedAt is set', async () => {
    findById.mockReturnValue({
      select: () => ({
        lean: async () => ({
          _id: '507f1f77bcf86cd799439011',
          deletedAt: new Date('2026-11-20T00:00:00.000Z')
        })
      })
    })

    await expect(softDeleteFlyerById(Flyer, '507f1f77bcf86cd799439011')).resolves.toEqual({
      matched: true,
      alreadyDeleted: true
    })
    expect(updateOne).not.toHaveBeenCalled()
  })

  it('sets deletedAt for an active flyer', async () => {
    findById.mockReturnValue({
      select: () => ({
        lean: async () => ({
          _id: '507f1f77bcf86cd799439011',
          deletedAt: null
        })
      })
    })
    updateOne.mockResolvedValue({ modifiedCount: 1 })

    await expect(softDeleteFlyerById(Flyer, '507f1f77bcf86cd799439011')).resolves.toEqual({
      matched: true,
      alreadyDeleted: false
    })

    expect(updateOne).toHaveBeenCalledTimes(1)
    expect(updateOne).toHaveBeenCalledWith(
      {
        _id: '507f1f77bcf86cd799439011',
        deletedAt: null
      },
      {
        $set: { deletedAt: expect.any(Date) }
      }
    )
  })
})
