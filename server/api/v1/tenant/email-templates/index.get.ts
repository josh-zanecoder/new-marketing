import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { EmailTemplateDoc, EmailTemplateModel } from '@server/types/tenant/emailTemplate.model'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'

type EmailTemplateLean = EmailTemplateDoc & {
  description?: string
  externalId?: string
  createdAt?: Date
  updatedAt?: Date
}

export default defineEventHandler(async (event) => {
  const conn = await getTenantConnectionFromEvent(event)
  const { EmailTemplate } = getTenantClientModels(conn)

  const docs = await (EmailTemplate as EmailTemplateModel)
    .find({})
    .sort({ updatedAt: -1 })
    .lean<EmailTemplateLean[]>()

  return {
    templates: docs.map((t) => ({
      id: String(t._id),
      name: t.name,
      description: t.description ?? '',
      subject: t.subject ?? '',
      externalId: t.externalId ?? '',
      htmlTemplate: t.htmlTemplate ?? t.html ?? '',
      createdAt: t.createdAt?.toISOString?.() ?? null,
      updatedAt: t.updatedAt?.toISOString?.() ?? null
    }))
  }
})
