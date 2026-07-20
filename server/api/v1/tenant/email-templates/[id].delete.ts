import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { EmailTemplateModel } from '@server/types/tenant/emailTemplate.model'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { softDeleteEmailTemplateById } from '@server/utils/emailTemplate/softDeleteEmailTemplate'

export default defineEventHandler(async (event) => {
  const rawId = getRouterParam(event, 'id')
  if (!rawId || !mongoose.isValidObjectId(rawId)) {
    throw createError({ statusCode: 400, message: 'Invalid template id' })
  }

  const conn = await getTenantConnectionFromEvent(event)
  const { EmailTemplate } = getTenantClientModels(conn)
  const result = await softDeleteEmailTemplateById(EmailTemplate as EmailTemplateModel, rawId)

  if (!result.matched) {
    throw createError({ statusCode: 404, message: 'Email template not found' })
  }

  return { ok: true, alreadyDeleted: result.alreadyDeleted }
})
