import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { EmailTemplateDoc, EmailTemplateModel } from '@server/types/tenant/emailTemplate.model'
import type { EmailTemplateCategoryModel } from '@server/types/tenant/emailTemplateCategory.model'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import {
  categoryIdToString,
  loadCategoryNameMap
} from '@server/utils/emailTemplate/emailTemplateCategoryLookup'
import {
  emailTemplateApprovalApiPayload,
  requireEmailTemplateApprover
} from '@server/utils/emailTemplate/emailTemplateApproval'
import { EMAIL_TEMPLATE_APPROVAL_PENDING } from '~~/shared/emailTemplateApproval'
import { ACTIVE_EMAIL_TEMPLATE_FILTER } from '~~/shared/utils/emailTemplateActive'
import { materializeEmailTemplateHtmlIfNeeded } from '@server/utils/emailTemplate/materializeEmailTemplateHtmlIfNeeded'

/**
 * Pending template approvals queue (OM / Marketing, LO recipient-lists flag ON).
 */
export default defineEventHandler(async (event) => {
  const { auth } = await requireEmailTemplateApprover(event)

  const conn = await getTenantConnectionFromEvent(event)
  const { EmailTemplate, EmailTemplateCategory } = getTenantClientModels(conn)
  const model = EmailTemplate as EmailTemplateModel
  const categoryModel = EmailTemplateCategory as EmailTemplateCategoryModel

  const docs = await model
    .find({
      ...ACTIVE_EMAIL_TEMPLATE_FILTER,
      approvalStatus: EMAIL_TEMPLATE_APPROVAL_PENDING
    })
    .sort({ approvalSubmittedAt: -1, updatedAt: -1 })
    .lean<EmailTemplateDoc[]>()

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
      const approval = emailTemplateApprovalApiPayload(t, auth)
      return {
        id,
        name: t.name,
        subject: t.subject ?? '',
        description: t.description ?? '',
        categoryId,
        categoryName: categoryId ? (nameById.get(categoryId) ?? null) : null,
        createdBy: String(t.createdBy ?? '').trim(),
        ownerEmail: String(t.metadata?.ownerEmail ?? '').trim(),
        htmlTemplate,
        createdAt: t.createdAt?.toISOString?.() ?? null,
        updatedAt: t.updatedAt?.toISOString?.() ?? null,
        ...(approval ?? {})
      }
    })
  )

  return { templates }
})
