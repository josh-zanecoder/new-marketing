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

export default defineEventHandler(async (event) => {
  const body = (await readBody(event).catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, message: 'Request body is required' })
  }

  const name = String(body.name ?? '').trim()
  const subject = String(body.subject ?? '').trim()
  const htmlTemplate = String(body.htmlTemplate ?? '').trim()
  const description = String(body.description ?? '').trim()
  const htmlSource = body.htmlSource === 'upload' ? 'upload' : 'editor'
  const saveToLibrary = body.saveToLibrary !== false
  const categoryIdRaw = parseOptionalCategoryId(body.categoryId)

  if (!name) throw createError({ statusCode: 400, message: 'Template name is required' })
  if (!subject) throw createError({ statusCode: 400, message: 'Default subject is required' })
  if (!htmlTemplate) throw createError({ statusCode: 400, message: 'Template HTML is required' })

  const conn = await getTenantConnectionFromEvent(event)
  const { EmailTemplate, EmailTemplateCategory } = getTenantClientModels(conn)
  const categoryModel = EmailTemplateCategory as EmailTemplateCategoryModel
  const categoryId = await resolveCategoryObjectId(categoryModel, categoryIdRaw)

  const doc = await (EmailTemplate as EmailTemplateModel).create({
    name,
    subject,
    description,
    htmlTemplate,
    htmlSource,
    saveToLibrary,
    categoryId: categoryId ?? null
  })

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
