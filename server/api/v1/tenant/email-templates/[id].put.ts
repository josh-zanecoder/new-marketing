import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { EmailTemplateModel } from '@server/types/tenant/emailTemplate.model'
import type { EmailTemplateCategoryModel } from '@server/types/tenant/emailTemplateCategory.model'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import {
  parseOptionalCategoryId,
  resolveCategoryObjectId
} from '@server/utils/emailTemplate/emailTemplateCategoryHelpers'
import {
  categoryIdToString,
  loadCategoryNameMap
} from '@server/utils/emailTemplate/emailTemplateCategoryLookup'
import { ACTIVE_EMAIL_TEMPLATE_FILTER } from '~~/shared/utils/emailTemplateActive'

export default defineEventHandler(async (event) => {
  const rawId = getRouterParam(event, 'id')
  if (!rawId || !mongoose.isValidObjectId(rawId)) {
    throw createError({ statusCode: 400, message: 'Invalid template id' })
  }

  const body = (await readBody(event).catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, message: 'Request body is required' })
  }

  const conn = await getTenantConnectionFromEvent(event)
  const { EmailTemplate, EmailTemplateCategory } = getTenantClientModels(conn)
  const categoryModel = EmailTemplateCategory as EmailTemplateCategoryModel

  const existing = await (EmailTemplate as EmailTemplateModel)
    .findOne({ _id: rawId, ...ACTIVE_EMAIL_TEMPLATE_FILTER })
    .select('_id')
    .lean()
  if (!existing) {
    throw createError({ statusCode: 404, message: 'Email template not found' })
  }

  const set: Record<string, unknown> = {}
  if (typeof body.name === 'string' && body.name.trim()) set.name = body.name.trim()
  if (typeof body.subject === 'string' && body.subject.trim()) set.subject = body.subject.trim()
  if (typeof body.description === 'string') set.description = body.description.trim()
  if (typeof body.htmlTemplate === 'string' && body.htmlTemplate.trim()) {
    set.htmlTemplate = body.htmlTemplate.trim()
  }
  if (body.htmlSource === 'upload' || body.htmlSource === 'editor') {
    set.htmlSource = body.htmlSource
  }
  if (typeof body.saveToLibrary === 'boolean') set.saveToLibrary = body.saveToLibrary
  if ('categoryId' in body) {
    const categoryIdRaw = parseOptionalCategoryId(body.categoryId)
    const categoryId = await resolveCategoryObjectId(categoryModel, categoryIdRaw)
    if (categoryId !== undefined) set.categoryId = categoryId
  }

  if (!Object.keys(set).length) {
    throw createError({ statusCode: 400, message: 'No valid fields to update' })
  }

  const doc = await (EmailTemplate as EmailTemplateModel).findOneAndUpdate(
    { _id: rawId, ...ACTIVE_EMAIL_TEMPLATE_FILTER },
    { $set: set },
    { new: true }
  )

  if (!doc) {
    throw createError({ statusCode: 404, message: 'Email template not found' })
  }

  const idStr = categoryIdToString(doc.categoryId)
  const nameById = await loadCategoryNameMap(categoryModel, [idStr])

  return {
    ok: true,
    template: {
      id: String(doc._id),
      name: doc.name,
      subject: doc.subject ?? '',
      description: doc.description ?? '',
      htmlTemplate: doc.htmlTemplate ?? '',
      categoryId: idStr,
      categoryName: idStr ? (nameById.get(idStr) ?? null) : null,
      createdAt: doc.createdAt?.toISOString?.() ?? null,
      updatedAt: doc.updatedAt?.toISOString?.() ?? null
    }
  }
})
