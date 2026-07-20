import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { EmailTemplateDoc, EmailTemplateModel } from '@server/types/tenant/emailTemplate.model'
import type { EmailTemplateCategoryModel } from '@server/types/tenant/emailTemplateCategory.model'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { materializeEmailTemplateHtmlIfNeeded } from '@server/utils/emailTemplate/materializeEmailTemplateHtmlIfNeeded'
import {
  categoryIdToString,
  loadCategoryNameMap
} from '@server/utils/emailTemplate/emailTemplateCategoryLookup'

type EmailTemplateLean = EmailTemplateDoc & {
  description?: string
  externalId?: string
  createdAt?: Date
  updatedAt?: Date
}

export default defineEventHandler(async (event) => {
  const conn = await getTenantConnectionFromEvent(event)
  const { EmailTemplate, EmailTemplateCategory } = getTenantClientModels(conn)
  const model = EmailTemplate as EmailTemplateModel
  const categoryModel = EmailTemplateCategory as EmailTemplateCategoryModel

  const docs = await model
    .find({ saveToLibrary: { $ne: false } })
    .sort({ updatedAt: -1 })
    .lean<EmailTemplateLean[]>()

  const categoryIds = docs.map((t) => categoryIdToString(t.categoryId))
  const nameById = await loadCategoryNameMap(categoryModel, categoryIds)

  const templates = await Promise.all(
    docs.map(async (t) => {
      const id = String(t._id)
      const categoryId = categoryIdToString(t.categoryId)
      const htmlTemplate = await materializeEmailTemplateHtmlIfNeeded({
        EmailTemplate: model,
        id,
        htmlTemplate: t.htmlTemplate ?? t.html ?? ''
      })
      return {
        id,
        name: t.name,
        description: t.description ?? '',
        subject: t.subject ?? '',
        externalId: t.externalId ?? '',
        categoryId,
        categoryName: categoryId ? (nameById.get(categoryId) ?? null) : null,
        htmlTemplate,
        createdAt: t.createdAt?.toISOString?.() ?? null,
        updatedAt: t.updatedAt?.toISOString?.() ?? null
      }
    })
  )

  return { templates }
})
