import { isAdminAuthContext } from '@server/tenant/registry-auth'
import { getTenantConnectionByTenantId } from '@server/tenant/connection'
import {
  BULK_UNSUBSCRIBE_MAX_EMAILS,
  bulkUnsubscribeContactsByEmail
} from '@server/utils/contact/bulkUnsubscribeContactsByEmail'

/**
 * Superadmin: bulk-unsubscribe contacts for a tenant by email list
 * (parsed from an Excel "Email" column on the client).
 *
 * POST /api/v1/admin/tenants/:tenantId/contacts/bulk-unsubscribe
 * body: { emails: string[] }
 */
export default defineEventHandler(async (event) => {
  const auth = event.context.auth as unknown
  if (!isAdminAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const rawTid = getRouterParam(event, 'tenantId') ?? ''
  const tenantId = decodeURIComponent(rawTid).trim()
  if (!tenantId) {
    throw createError({ statusCode: 400, message: 'tenantId is required' })
  }

  const body = (await readBody(event).catch(() => null)) as { emails?: unknown } | null
  if (!body || !Array.isArray(body.emails)) {
    throw createError({ statusCode: 400, message: 'emails (array) is required' })
  }
  if (body.emails.length === 0) {
    throw createError({ statusCode: 400, message: 'emails array is empty' })
  }
  if (body.emails.length > BULK_UNSUBSCRIBE_MAX_EMAILS) {
    throw createError({
      statusCode: 400,
      message: `At most ${BULK_UNSUBSCRIBE_MAX_EMAILS} emails per upload`
    })
  }

  const tenantConn = await getTenantConnectionByTenantId(tenantId)
  if (!tenantConn) {
    throw createError({ statusCode: 404, message: 'Tenant not found' })
  }

  const result = await bulkUnsubscribeContactsByEmail(tenantConn, body.emails)
  return { ok: true, ...result }
})
