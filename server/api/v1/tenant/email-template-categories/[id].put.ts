import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { EmailTemplateCategoryModel } from '@server/types/tenant/emailTemplateCategory.model'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import {
  categoryNameFromBody,
  serializeCategory
} from '@server/utils/emailTemplate/emailTemplateCategoryHelpers'

export default defineEventHandler(async (event) => {
  const rawId = getRouterParam(event, 'id')
  if (!rawId || !mongoose.isValidObjectId(rawId)) {
    throw createError({ statusCode: 400, message: 'Invalid category id' })
  }

  const body = (await readBody(event).catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, message: 'Request body is required' })
  }

  const conn = await getTenantConnectionFromEvent(event)
  const { EmailTemplateCategory } = getTenantClientModels(conn)
  const model = EmailTemplateCategory as EmailTemplateCategoryModel

  const existing = await model.findById(rawId).select('_id').lean()
  if (!existing) {
    throw createError({ statusCode: 404, message: 'Category not found' })
  }

  const set: Record<string, unknown> = {}
  if (typeof body.name === 'string') {
    const name = categoryNameFromBody(body.name)
    if (!name) throw createError({ statusCode: 400, message: 'Category name is required' })
    const duplicate = await model
      .findOne({ name, _id: { $ne: rawId } })
      .collation({ locale: 'en', strength: 2 })
      .select('_id')
      .lean()
    if (duplicate) {
      throw createError({ statusCode: 409, message: 'A category with this name already exists' })
    }
    set.name = name
  }
  if (typeof body.description === 'string') set.description = body.description.trim()
  if (typeof body.sortOrder === 'number' && Number.isFinite(body.sortOrder)) {
    set.sortOrder = body.sortOrder
  }

  if (!Object.keys(set).length) {
    throw createError({ statusCode: 400, message: 'No valid fields to update' })
  }

  try {
    const doc = await model.findByIdAndUpdate(rawId, { $set: set }, { new: true })
    if (!doc) throw createError({ statusCode: 404, message: 'Category not found' })
    return { ok: true, category: serializeCategory(doc) }
  } catch (e: unknown) {
    const code = e && typeof e === 'object' && 'code' in e ? Number((e as { code: number }).code) : 0
    if (code === 11000) {
      throw createError({ statusCode: 409, message: 'A category with this name already exists' })
    }
    throw e
  }
})
