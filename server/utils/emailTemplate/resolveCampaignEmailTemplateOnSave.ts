import mongoose from 'mongoose'
import type { EmailTemplateModel } from '@server/types/tenant/emailTemplate.model'
import type { Connection } from 'mongoose'

export type CampaignTemplateSaveInput = {
  campaignName: string
  subject?: string
  emailTemplateId?: string
  templateHtml?: string
  templateHtmlSource?: 'editor' | 'upload'
  saveHtmlToLibrary?: boolean
  /** Existing linked template on campaign update. */
  currentEmailTemplateId?: string | mongoose.Types.ObjectId | null
}

export type CampaignTemplateSaveResult = {
  emailTemplateId?: string
}

/**
 * Links an existing library template or creates/updates HTML-backed templates.
 * When `emailTemplateId` is provided (and no `templateHtml`), reuses that template — no duplicate row.
 */
export async function resolveCampaignEmailTemplateOnSave(
  tenantConn: Connection,
  EmailTemplate: EmailTemplateModel,
  input: CampaignTemplateSaveInput
): Promise<CampaignTemplateSaveResult> {
  const html = String(input.templateHtml ?? '').trim()
  const linkId = String(input.emailTemplateId ?? '').trim()

  if (html) {
    const htmlSource = input.templateHtmlSource === 'upload' ? 'upload' : 'editor'
    const saveToLibrary = input.saveHtmlToLibrary === true
    const currentId = input.currentEmailTemplateId
      ? String(input.currentEmailTemplateId)
      : ''

    if (currentId && mongoose.isValidObjectId(currentId)) {
      await EmailTemplate.updateOne(
        { _id: new mongoose.Types.ObjectId(currentId) },
        {
          $set: {
            htmlTemplate: html,
            htmlSource,
            subject: input.subject?.trim() || input.campaignName.trim(),
            saveToLibrary
          }
        }
      )
      return { emailTemplateId: currentId }
    }

    const template = await new EmailTemplate({
      name: `${input.campaignName.trim()} - Template`,
      subject: input.subject?.trim() || input.campaignName.trim(),
      htmlTemplate: html,
      htmlSource,
      saveToLibrary
    }).save()
    return { emailTemplateId: template._id.toString() }
  }

  if (linkId && mongoose.isValidObjectId(linkId)) {
    const exists = await EmailTemplate.findById(linkId).select('_id').lean()
    if (!exists) {
      throw createError({ statusCode: 400, message: 'Selected email template was not found' })
    }
    return { emailTemplateId: linkId }
  }

  return {}
}
