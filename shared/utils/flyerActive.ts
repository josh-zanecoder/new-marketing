/** Flyers eligible for tenant library list / file access (not soft-deleted). */
export const ACTIVE_FLYER_FILTER = {
  deletedAt: null
} as const

/** Soft-deleted flyers (retained for recovery / audit). */
export const DELETED_FLYER_FILTER = {
  deletedAt: { $ne: null }
} as const

export function isFlyerSoftDeleted(deletedAt: Date | string | null | undefined): boolean {
  return deletedAt != null && deletedAt !== ''
}
