import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { EmailTemplateDoc, EmailTemplateModel } from '@server/types/tenant/emailTemplate.model'
import type { EmailTemplateCategoryModel } from '@server/types/tenant/emailTemplateCategory.model'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { materializeEmailTemplateHtmlIfNeeded } from '@server/utils/emailTemplate/materializeEmailTemplateHtmlIfNeeded'
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

  const conn = await getTenantConnectionFromEvent(event)
  const { EmailTemplate, EmailTemplateCategory } = getTenantClientModels(conn)
  const model = EmailTemplate as EmailTemplateModel
  const categoryModel = EmailTemplateCategory as EmailTemplateCategoryModel

  const doc = await model
    .findOne({ _id: rawId, ...ACTIVE_EMAIL_TEMPLATE_FILTER })
    .lean<EmailTemplateDoc | null>()

  if (!doc) {
    throw createError({ statusCode: 404, message: 'Email template not found' })
  }

  const htmlTemplate = await materializeEmailTemplateHtmlIfNeeded({
    EmailTemplate: model,
    id: String(doc._id),
    htmlTemplate: doc.htmlTemplate ?? doc.html ?? ''
  })

  const categoryId = categoryIdToString(doc.categoryId)
  const nameById = await loadCategoryNameMap(categoryModel, [categoryId])

  return {
    template: {
      id: String(doc._id),
      name: doc.name ?? '',
      description: doc.description ?? '',
      subject: doc.subject ?? '',
      htmlTemplate,
      htmlSource: doc.htmlSource === 'upload' ? 'upload' : 'editor',
      saveToLibrary: doc.saveToLibrary !== false,
      externalId: doc.externalId ?? '',
      categoryId,
      categoryName: categoryId ? (nameById.get(categoryId) ?? null) : null,
      createdAt: doc.createdAt?.toISOString?.() ?? null,
      updatedAt: doc.updatedAt?.toISOString?.() ?? null
    }
  }
})
