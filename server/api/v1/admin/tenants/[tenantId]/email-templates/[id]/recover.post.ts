import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { EmailTemplateModel } from '@server/types/tenant/emailTemplate.model'
import { isAdminAuthContext } from '@server/tenant/registry-auth'
import { getTenantConnectionByTenantId } from '@server/tenant/connection'
import { recoverSoftDeletedEmailTemplate } from '@server/utils/emailTemplate/recoverEmailTemplate'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as unknown
  if (!isAdminAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const rawTid = getRouterParam(event, 'tenantId') ?? ''
  const tenantId = decodeURIComponent(rawTid).trim()
  const id = getRouterParam(event, 'id') ?? ''
  if (!tenantId || !id || !mongoose.Types.ObjectId.isValid(id)) {
    throw createError({ statusCode: 400, message: 'Invalid request' })
  }

  const tenantConn = await getTenantConnectionByTenantId(tenantId)
  if (!tenantConn) {
    throw createError({ statusCode: 404, message: 'Tenant not found' })
  }

  const { EmailTemplate } = getTenantClientModels(tenantConn)
  const result = await recoverSoftDeletedEmailTemplate(EmailTemplate as EmailTemplateModel, id)

  if (!result.ok) {
    throw createError({ statusCode: 404, message: 'Email template not found' })
  }

  return { ok: true, alreadyActive: result.alreadyActive }
})
