import type { Types } from 'mongoose'
import type { FlyerModel } from '@server/types/tenant/flyer.model'
import { DELETED_FLYER_FILTER } from '~~/shared/utils/flyerActive'

export type RecoverFlyerResult =
  | { ok: true; alreadyActive: boolean }
  | { ok: false; reason: 'not_found' }

export async function recoverSoftDeletedFlyer(
  Flyer: FlyerModel,
  flyerId: Types.ObjectId | string
): Promise<RecoverFlyerResult> {
  const existing = await Flyer.findById(flyerId).select('_id deletedAt').lean()
  if (!existing) return { ok: false, reason: 'not_found' }
  if (existing.deletedAt == null) return { ok: true, alreadyActive: true }

  await Flyer.updateOne(
    { _id: existing._id, ...DELETED_FLYER_FILTER },
    { $set: { deletedAt: null } }
  )
  return { ok: true, alreadyActive: false }
}
