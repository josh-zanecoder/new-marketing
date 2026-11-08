import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { EmailTemplateModel } from '@server/types/tenant/emailTemplate.model'
import type { EmailTemplateCategoryModel } from '@server/types/tenant/emailTemplateCategory.model'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import {
  categoryIdToString,
  loadCategoryNameMap
} from '@server/utils/emailTemplate/emailTemplateCategoryLookup'
import {
  emailTemplateApprovalApiPayload,
  emailTemplateApprovalFieldsOnReject,
  requireEmailTemplateApprover
} from '@server/utils/emailTemplate/emailTemplateApproval'
import { EMAIL_TEMPLATE_APPROVAL_PENDING } from '~~/shared/emailTemplateApproval'
import { ACTIVE_EMAIL_TEMPLATE_FILTER } from '~~/shared/utils/emailTemplateActive'

export default defineEventHandler(async (event) => {
  const { auth } = await requireEmailTemplateApprover(event)

  const rawId = getRouterParam(event, 'id')
  if (!rawId || !mongoose.isValidObjectId(rawId)) {
    throw createError({ statusCode: 400, message: 'Invalid template id' })
  }

  const body = (await readBody(event).catch(() => null)) as Record<string, unknown> | null
  const reason =
    body && typeof body.reason === 'string'
      ? body.reason.trim()
      : body && typeof body.rejectionReason === 'string'
        ? body.rejectionReason.trim()
        : ''

  const conn = await getTenantConnectionFromEvent(event)
  const { EmailTemplate, EmailTemplateCategory } = getTenantClientModels(conn)
  const categoryModel = EmailTemplateCategory as EmailTemplateCategoryModel

  const existing = await (EmailTemplate as EmailTemplateModel)
    .findOne({ _id: rawId, ...ACTIVE_EMAIL_TEMPLATE_FILTER })
    .select('_id approvalStatus')
    .lean()
  if (!existing) {
    throw createError({ statusCode: 404, message: 'Email template not found' })
  }
  if (existing.approvalStatus !== EMAIL_TEMPLATE_APPROVAL_PENDING) {
    throw createError({
      statusCode: 409,
      message: 'Only pending templates can be rejected'
    })
  }

  const doc = await (EmailTemplate as EmailTemplateModel).findOneAndUpdate(
    {
      _id: rawId,
      ...ACTIVE_EMAIL_TEMPLATE_FILTER,
      approvalStatus: EMAIL_TEMPLATE_APPROVAL_PENDING
    },
    { $set: emailTemplateApprovalFieldsOnReject(auth, reason) },
    { new: true }
  )
  if (!doc) {
    throw createError({ statusCode: 409, message: 'Template is no longer pending approval' })
  }

  const idStr = categoryIdToString(doc.categoryId)
  const nameById = await loadCategoryNameMap(categoryModel, [idStr])
  const approval = emailTemplateApprovalApiPayload(doc, auth)

  return {
    ok: true,
    template: {
      id: String(doc._id),
      name: doc.name,
      subject: doc.subject ?? '',
      description: doc.description ?? '',
      categoryId: idStr,
      categoryName: idStr ? (nameById.get(idStr) ?? null) : null,
      createdAt: doc.createdAt?.toISOString?.() ?? null,
      updatedAt: doc.updatedAt?.toISOString?.() ?? null,
      ...(approval ?? {})
    }
  }
})
