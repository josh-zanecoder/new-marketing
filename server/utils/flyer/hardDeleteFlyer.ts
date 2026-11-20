import type { Types } from 'mongoose'
import { deleteCustomMarketingTenantImages } from '@server/services/customMarketingImageUpload.service'
import type { FlyerModel } from '@server/types/tenant/flyer.model'
import { DELETED_FLYER_FILTER } from '~~/shared/utils/flyerActive'

export type HardDeleteFlyerResult =
  | { ok: true; gcsDeleted: boolean }
  | { ok: false; reason: 'not_found' | 'not_soft_deleted' }

/**
 * Permanently remove a soft-deleted flyer doc (and best-effort GCS object).
 * Only soft-deleted rows can be hard-deleted.
 */
export async function hardDeleteSoftDeletedFlyer(params: {
  Flyer: FlyerModel
  flyerId: Types.ObjectId | string
  tenantFolderName: string
}): Promise<HardDeleteFlyerResult> {
  const { Flyer, flyerId, tenantFolderName } = params
  const existing = await Flyer.findById(flyerId)
    .select('_id deletedAt objectPath')
    .lean()
  if (!existing) return { ok: false, reason: 'not_found' }
  if (existing.deletedAt == null) return { ok: false, reason: 'not_soft_deleted' }

  const objectPath = typeof existing.objectPath === 'string' ? existing.objectPath.trim() : ''
  let gcsDeleted = false
  if (objectPath && tenantFolderName.trim()) {
    try {
      const result = await deleteCustomMarketingTenantImages(
        tenantFolderName.trim(),
        [objectPath],
        { ownerEmails: null }
      )
      gcsDeleted = result.deleted.includes(objectPath)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[flyers.hardDelete] GCS object delete failed', { objectPath, error: message })
    }
  }

  await Flyer.deleteOne({ _id: existing._id, ...DELETED_FLYER_FILTER })
  return { ok: true, gcsDeleted }
}
