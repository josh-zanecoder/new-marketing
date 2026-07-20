import mongoose from 'mongoose'
import type { EmailTemplateCategoryModel } from '@server/types/tenant/emailTemplateCategory.model'
import { normalizeEmailTemplateCategoryName } from '~~/shared/utils/emailTemplateCategory'

/** Parse optional categoryId from a request body. Empty string clears; invalid id throws 400. */
export function parseOptionalCategoryId(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined
  if (raw === null) return null
  const value = String(raw).trim()
  if (!value) return null
  if (!mongoose.isValidObjectId(value)) {
    throw createError({ statusCode: 400, message: 'Invalid category id' })
  }
  return value
}

/** Ensure category exists when assigning; returns ObjectId or null. */
export async function resolveCategoryObjectId(
  EmailTemplateCategory: EmailTemplateCategoryModel,
  categoryId: string | null | undefined
): Promise<mongoose.Types.ObjectId | null | undefined> {
  if (categoryId === undefined) return undefined
  if (categoryId === null) return null
  const exists = await EmailTemplateCategory.findById(categoryId).select('_id').lean()
  if (!exists) {
    throw createError({ statusCode: 400, message: 'Category not found' })
  }
  return new mongoose.Types.ObjectId(categoryId)
}

export function categoryNameFromBody(raw: unknown): string {
  return normalizeEmailTemplateCategoryName(String(raw ?? ''))
}

export function serializeCategory(doc: {
  _id: mongoose.Types.ObjectId
  name: string
  description?: string
  sortOrder?: number
  createdAt?: Date
  updatedAt?: Date
}) {
  return {
    id: String(doc._id),
    name: doc.name,
    description: doc.description ?? '',
    sortOrder: typeof doc.sortOrder === 'number' ? doc.sortOrder : 0,
    createdAt: doc.createdAt?.toISOString?.() ?? null,
    updatedAt: doc.updatedAt?.toISOString?.() ?? null
  }
}
