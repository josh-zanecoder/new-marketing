import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { EmailTemplateDoc, EmailTemplateModel } from '@server/types/tenant/emailTemplate.model'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { materializeEmailTemplateHtmlIfNeeded } from '@server/utils/emailTemplate/materializeEmailTemplateHtmlIfNeeded'

type EmailTemplateLean = EmailTemplateDoc & {
  description?: string
  externalId?: string
  createdAt?: Date
  updatedAt?: Date
}

export default defineEventHandler(async (event) => {
  const conn = await getTenantConnectionFromEvent(event)
  const { EmailTemplate } = getTenantClientModels(conn)
  const model = EmailTemplate as EmailTemplateModel

  const docs = await model
    .find({ saveToLibrary: { $ne: false } })
    .sort({ updatedAt: -1 })
    .lean<EmailTemplateLean[]>()

  const templates = await Promise.all(
    docs.map(async (t) => {
      const id = String(t._id)
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
        htmlTemplate,
        createdAt: t.createdAt?.toISOString?.() ?? null,
        updatedAt: t.updatedAt?.toISOString?.() ?? null
      }
    })
  )

  return { templates }
})
