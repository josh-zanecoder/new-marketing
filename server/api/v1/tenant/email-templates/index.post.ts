import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { EmailTemplateModel } from '@server/types/tenant/emailTemplate.model'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'

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

  if (!name) throw createError({ statusCode: 400, message: 'Template name is required' })
  if (!subject) throw createError({ statusCode: 400, message: 'Default subject is required' })
  if (!htmlTemplate) throw createError({ statusCode: 400, message: 'Template HTML is required' })

  const conn = await getTenantConnectionFromEvent(event)
  const { EmailTemplate } = getTenantClientModels(conn)

  const doc = await (EmailTemplate as EmailTemplateModel).create({
    name,
    subject,
    description,
    htmlTemplate,
    htmlSource,
    saveToLibrary
  })

  return {
    ok: true,
    template: {
      id: String(doc._id),
      name: doc.name,
      subject: doc.subject ?? '',
      description: doc.description ?? '',
      htmlTemplate: doc.htmlTemplate ?? '',
      createdAt: doc.createdAt?.toISOString?.() ?? null,
      updatedAt: doc.updatedAt?.toISOString?.() ?? null
    }
  }
})
