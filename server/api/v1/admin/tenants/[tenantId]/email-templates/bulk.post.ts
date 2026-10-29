import { isAdminAuthContext } from '@server/tenant/registry-auth'
import { getTenantConnectionByTenantId } from '@server/tenant/connection'
import {
  bulkCreateAdminEmailTemplates,
  type BulkAdminEmailTemplateInput
} from '@server/utils/admin/bulkCreateAdminEmailTemplates'
import { BULK_EMAIL_TEMPLATES_MAX_PER_REQUEST } from '~~/shared/utils/uploadedEmailHtml'

/**
 * Superadmin: bulk-create email templates for a tenant from HTML payloads
 * (files are read client-side; body is JSON).
 *
 * Client should chunk large batches (see `chunkBulkEmailTemplatesForRequests`) so each
 * POST stays under common nginx/CDN body limits — no proxy config required.
 *
 * POST /api/v1/admin/tenants/:tenantId/email-templates/bulk
 * body: { templates: [{ name, subject?, htmlTemplate, description?, categoryId? }] }
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

  const body = (await readBody(event).catch(() => null)) as {
    templates?: unknown
  } | null
  if (!body || !Array.isArray(body.templates)) {
    throw createError({ statusCode: 400, message: 'templates (array) is required' })
  }
  if (body.templates.length === 0) {
    throw createError({ statusCode: 400, message: 'templates array is empty' })
  }
  if (body.templates.length > BULK_EMAIL_TEMPLATES_MAX_PER_REQUEST) {
    throw createError({
      statusCode: 400,
      message: `At most ${BULK_EMAIL_TEMPLATES_MAX_PER_REQUEST} templates per request (client should chunk larger uploads)`
    })
  }

  const templates: BulkAdminEmailTemplateInput[] = []
  for (const row of body.templates) {
    if (!row || typeof row !== 'object') {
      throw createError({ statusCode: 400, message: 'Each template must be an object' })
    }
    const r = row as Record<string, unknown>
    templates.push({
      name: String(r.name ?? ''),
      subject: r.subject == null ? undefined : String(r.subject),
      htmlTemplate: String(r.htmlTemplate ?? ''),
      description: r.description == null ? undefined : String(r.description),
      categoryId: (r.categoryId as string | null | undefined) ?? null
    })
  }

  const tenantConn = await getTenantConnectionByTenantId(tenantId)
  if (!tenantConn) {
    throw createError({ statusCode: 404, message: 'Tenant not found' })
  }

  const authObj = auth as { uid?: string; email?: string }
  const createdBy =
    (typeof authObj.uid === 'string' && authObj.uid.trim())
    || (typeof authObj.email === 'string' && authObj.email.trim())
    || 'admin'

  const result = await bulkCreateAdminEmailTemplates(tenantConn, templates, createdBy)
  return { ok: true, ...result }
})
