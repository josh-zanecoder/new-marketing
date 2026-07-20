/** Templates eligible for library list / pickers (not soft-deleted). */
export const ACTIVE_EMAIL_TEMPLATE_FILTER = {
  deletedAt: null
} as const

/** Soft-deleted templates (admin trash / hard-delete candidates). */
export const DELETED_EMAIL_TEMPLATE_FILTER = {
  deletedAt: { $ne: null }
} as const

export function isEmailTemplateSoftDeleted(deletedAt: Date | string | null | undefined): boolean {
  return deletedAt != null && deletedAt !== ''
}
