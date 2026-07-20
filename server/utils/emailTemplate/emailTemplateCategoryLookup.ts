import type { Types } from 'mongoose'
import type { EmailTemplateCategoryModel } from '@server/types/tenant/emailTemplateCategory.model'

export function categoryIdToString(categoryId: Types.ObjectId | string | null | undefined): string | null {
  if (!categoryId) return null
  return String(categoryId)
}

/** Load id → name map for the given category ids. */
export async function loadCategoryNameMap(
  EmailTemplateCategory: EmailTemplateCategoryModel,
  categoryIds: Array<string | null | undefined>
): Promise<Map<string, string>> {
  const unique = [...new Set(categoryIds.filter((id): id is string => Boolean(id && id.trim())))]
  if (!unique.length) return new Map()
  const docs = await EmailTemplateCategory.find({ _id: { $in: unique } })
    .select({ _id: 1, name: 1 })
    .lean()
  return new Map(docs.map((d) => [String(d._id), d.name]))
}
