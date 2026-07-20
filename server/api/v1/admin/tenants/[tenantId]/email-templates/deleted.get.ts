import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { EmailTemplateDoc, EmailTemplateModel } from '@server/types/tenant/emailTemplate.model'
import type { EmailTemplateCategoryModel } from '@server/types/tenant/emailTemplateCategory.model'
import { isAdminAuthContext } from '@server/tenant/registry-auth'
import { getTenantConnectionByTenantId } from '@server/tenant/connection'
import { materializeEmailTemplateHtmlIfNeeded } from '@server/utils/emailTemplate/materializeEmailTemplateHtmlIfNeeded'
import {
  categoryIdToString,
  loadCategoryNameMap
} from '@server/utils/emailTemplate/emailTemplateCategoryLookup'
import { DELETED_EMAIL_TEMPLATE_FILTER } from '~~/shared/utils/emailTemplateActive'

type EmailTemplateLean = EmailTemplateDoc & {
  description?: string
  externalId?: string
  createdAt?: Date
  updatedAt?: Date
  deletedAt?: Date | null
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as unknown
  if (!isAdminAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const raw = getRouterParam(event, 'tenantId') ?? ''
  const tenantId = decodeURIComponent(raw).trim()
  if (!tenantId) {
    throw createError({ statusCode: 400, message: 'Missing tenant id' })
  }

  const tenantConn = await getTenantConnectionByTenantId(tenantId)
  if (!tenantConn) {
    throw createError({ statusCode: 404, message: 'Tenant not found' })
  }

  const { EmailTemplate, EmailTemplateCategory } = getTenantClientModels(tenantConn)
  const model = EmailTemplate as EmailTemplateModel
  const categoryModel = EmailTemplateCategory as EmailTemplateCategoryModel

  const docs = await model
    .find(DELETED_EMAIL_TEMPLATE_FILTER)
    .sort({ deletedAt: -1 })
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
        updatedAt: t.updatedAt?.toISOString?.() ?? null,
        deletedAt: t.deletedAt?.toISOString?.() ?? null
      }
    })
  )

  return { templates }
})
