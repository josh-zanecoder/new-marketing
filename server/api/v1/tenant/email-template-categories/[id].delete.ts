import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { EmailTemplateCategoryModel } from '@server/types/tenant/emailTemplateCategory.model'
import type { EmailTemplateModel } from '@server/types/tenant/emailTemplate.model'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'

export default defineEventHandler(async (event) => {
  const rawId = getRouterParam(event, 'id')
  if (!rawId || !mongoose.isValidObjectId(rawId)) {
    throw createError({ statusCode: 400, message: 'Invalid category id' })
  }

  const conn = await getTenantConnectionFromEvent(event)
  const { EmailTemplateCategory, EmailTemplate } = getTenantClientModels(conn)
  const categoryModel = EmailTemplateCategory as EmailTemplateCategoryModel
  const templateModel = EmailTemplate as EmailTemplateModel

  const existing = await categoryModel.findById(rawId).select('_id').lean()
  if (!existing) {
    throw createError({ statusCode: 404, message: 'Category not found' })
  }

  const categoryObjectId = new mongoose.Types.ObjectId(rawId)
  const cleared = await templateModel.updateMany(
    { categoryId: categoryObjectId },
    { $set: { categoryId: null } }
  )
  await categoryModel.deleteOne({ _id: categoryObjectId })

  return {
    ok: true,
    templatesCleared: cleared.modifiedCount ?? 0
  }
})
