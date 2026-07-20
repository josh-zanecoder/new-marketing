import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { EmailTemplateModel } from '@server/types/tenant/emailTemplate.model'
import { isAdminAuthContext } from '@server/tenant/registry-auth'
import { getTenantConnectionByTenantId } from '@server/tenant/connection'
import { hardDeleteSoftDeletedEmailTemplate } from '@server/utils/emailTemplate/hardDeleteEmailTemplate'

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
  const result = await hardDeleteSoftDeletedEmailTemplate(
    tenantConn,
    EmailTemplate as EmailTemplateModel,
    id
  )

  if (!result.ok) {
    if (result.reason === 'not_found') {
      throw createError({ statusCode: 404, message: 'Email template not found' })
    }
    throw createError({
      statusCode: 400,
      message: 'Only soft-deleted templates can be permanently deleted'
    })
  }

  return { ok: true, campaignsCleared: result.campaignsCleared }
})
