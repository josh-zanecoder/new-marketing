import type { Connection } from 'mongoose'
import mongoose from 'mongoose'
import type { EmailTemplateModel } from '@server/types/tenant/emailTemplate.model'
import { rewriteCustomMarketingDataImagesToGcs } from '@server/services/customMarketingImageUpload.service'
import { resolveCampaignTemplateHtmlSource } from '~~/shared/campaignTemplateSource'
import {
  CUSTOM_MARKETING_GCS_NO_LIST_FOLDER,
  htmlContainsCustomMarketingDataImages
} from '~~/shared/customMarketingHostedImages'

export type CampaignTemplateSaveInput = {
  campaignName: string
  subject?: string
  emailTemplateId?: string
  templateHtml?: string
  templateHtmlSource?: 'editor' | 'upload' | 'custom'
  saveHtmlToLibrary?: boolean
  /** Existing linked template on campaign update. */
  currentEmailTemplateId?: string | mongoose.Types.ObjectId | null
  /** Tenant display name — GCS folder `custom-marketing/{tenantName}/{listId}/`. */
  tenantName?: string
  /** Recipient list id — optional; without a list, images use the `no-list` folder. */
  recipientListId?: string
}

export type CampaignTemplateSaveResult = {
  emailTemplateId?: string
}

/**
 * Links an existing library template or creates/updates HTML-backed templates.
 * When `emailTemplateId` is provided (and no `templateHtml`), reuses that template — no duplicate row.
 */
export async function resolveCampaignEmailTemplateOnSave(
  _tenantConn: Connection,
  EmailTemplate: EmailTemplateModel,
  input: CampaignTemplateSaveInput
): Promise<CampaignTemplateSaveResult> {
  let html = String(input.templateHtml ?? '').trim()
  const linkId = String(input.emailTemplateId ?? '').trim()
  const tenantName = String(input.tenantName ?? '').trim()
  const recipientListId =
    String(input.recipientListId ?? '').trim() || CUSTOM_MARKETING_GCS_NO_LIST_FOLDER

  if (html && htmlContainsCustomMarketingDataImages(html)) {
    if (!tenantName) {
      throw createError({
        statusCode: 400,
        message: 'Photos must be hosted for email clients. Configure GCS tenant credentials.'
      })
    }
    html = await rewriteCustomMarketingDataImagesToGcs(html, { tenantName, recipientListId })
  }

  if (html) {
    const htmlSource = resolveCampaignTemplateHtmlSource(input.templateHtmlSource)
    const saveToLibrary =
      htmlSource === 'custom' ? false : input.saveHtmlToLibrary === true
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
