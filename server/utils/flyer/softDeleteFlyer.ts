import type { Types } from 'mongoose'
import type { FlyerModel } from '@server/types/tenant/flyer.model'
import { ACTIVE_FLYER_FILTER } from '~~/shared/utils/flyerActive'

export async function softDeleteFlyerById(
  Flyer: FlyerModel,
  flyerId: Types.ObjectId | string
): Promise<{ matched: boolean; alreadyDeleted: boolean }> {
  const existing = await Flyer.findById(flyerId).select('_id deletedAt').lean()
  if (!existing) return { matched: false, alreadyDeleted: false }
  if (existing.deletedAt != null) return { matched: true, alreadyDeleted: true }

  await Flyer.updateOne(
    { _id: flyerId, ...ACTIVE_FLYER_FILTER },
    { $set: { deletedAt: new Date() } }
  )
  return { matched: true, alreadyDeleted: false }
}
