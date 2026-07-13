import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { EmailTemplateDoc, EmailTemplateModel } from '@server/types/tenant/emailTemplate.model'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { materializeEmailTemplateHtmlIfNeeded } from '@server/utils/emailTemplate/materializeEmailTemplateHtmlIfNeeded'

export default defineEventHandler(async (event) => {
  const rawId = getRouterParam(event, 'id')
  if (!rawId || !mongoose.isValidObjectId(rawId)) {
    throw createError({ statusCode: 400, message: 'Invalid template id' })
  }

  const conn = await getTenantConnectionFromEvent(event)
  const { EmailTemplate } = getTenantClientModels(conn)
  const model = EmailTemplate as EmailTemplateModel

  const doc = await model.findById(rawId).lean<EmailTemplateDoc | null>()

  if (!doc) {
    throw createError({ statusCode: 404, message: 'Email template not found' })
  }

  const htmlTemplate = await materializeEmailTemplateHtmlIfNeeded({
    EmailTemplate: model,
    id: String(doc._id),
    htmlTemplate: doc.htmlTemplate ?? doc.html ?? ''
  })

  return {
    template: {
      id: String(doc._id),
      name: doc.name ?? '',
      description: doc.description ?? '',
      subject: doc.subject ?? '',
      htmlTemplate,
      htmlSource: doc.htmlSource === 'upload' ? 'upload' : 'editor',
      saveToLibrary: doc.saveToLibrary !== false,
      externalId: doc.externalId ?? '',
      createdAt: doc.createdAt?.toISOString?.() ?? null,
      updatedAt: doc.updatedAt?.toISOString?.() ?? null
    }
  }
})
