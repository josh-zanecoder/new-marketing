import type { Connection } from 'mongoose'
import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { CampaignModel } from '@server/types/tenant/campaign.model'
import type { EmailTemplateDoc, EmailTemplateModel } from '@server/types/tenant/emailTemplate.model'
import { rewriteCustomMarketingDataImagesToGcs } from '@server/services/customMarketingImageUpload.service'
import {
  canWriteEmailTemplate,
  emailTemplateOwnershipFromAuth,
  mergeEmailTemplateVisibilityFilter
} from '@server/utils/emailTemplate/emailTemplateOwnership'
import { resolveCampaignTemplateHtmlSource } from '~~/shared/campaignTemplateSource'
import {
  CUSTOM_MARKETING_GCS_NO_LIST_FOLDER,
  htmlContainsCustomMarketingDataImages
} from '~~/shared/customMarketingHostedImages'
import { ACTIVE_EMAIL_TEMPLATE_FILTER } from '~~/shared/utils/emailTemplateActive'
import { ensureEmailTemplateUnsubscribe } from '~~/shared/utils/ensureEmailTemplateUnsubscribe'

export type CampaignTemplateSaveInput = {
  campaignName: string
  subject?: string
  emailTemplateId?: string
  templateHtml?: string
  templateHtmlSource?: 'editor' | 'upload' | 'custom'
  saveHtmlToLibrary?: boolean
  /** Existing linked template on campaign update. */
  currentEmailTemplateId?: string | mongoose.Types.ObjectId | null
  /** Campaign being updated; other campaigns sharing its template force a copy. */
  campaignId?: string | mongoose.Types.ObjectId | null
  /** Session of the user saving the campaign (template ownership + visibility). */
  auth?: unknown
  /** Tenant display name — GCS folder `custom-marketing/{tenantName}/{listId}/`. */
  tenantName?: string
  /** Recipient list id — optional; without a list, images use the `no-list` folder. */
  recipientListId?: string
}

export type CampaignTemplateSaveResult = {
  emailTemplateId?: string
}

/**
 * True when the campaign's template can be edited in place: no other campaign uses it,
 * it is not CRM-managed, and it is either campaign-only or writable by this user.
 */
async function isTemplateExclusiveToCampaign(params: {
  EmailTemplate: EmailTemplateModel
  Campaign: CampaignModel
  templateId: string
  campaignId?: string
  auth: unknown
}): Promise<boolean> {
  const template = await params.EmailTemplate.findById(params.templateId)
    .select('_id saveToLibrary externalId metadata')
    .lean<EmailTemplateDoc | null>()
  if (!template) return false
  if (String(template.externalId ?? '').trim()) return false

  const otherCampaignFilter: Record<string, unknown> = {
    emailTemplate: new mongoose.Types.ObjectId(params.templateId)
  }
  if (params.campaignId && mongoose.isValidObjectId(params.campaignId)) {
    otherCampaignFilter._id = { $ne: new mongoose.Types.ObjectId(params.campaignId) }
  }
  const otherCampaigns = await params.Campaign.countDocuments(otherCampaignFilter)
  if (otherCampaigns > 0) return false

  if (template.saveToLibrary === false) return true
  return canWriteEmailTemplate(template, params.auth)
}

/**
 * Every campaign owns its template: library picks are copied (never linked), and design edits
 * only update in place when no other campaign uses the same template.
 */
export async function resolveCampaignEmailTemplateOnSave(
  tenantConn: Connection,
  EmailTemplate: EmailTemplateModel,
  input: CampaignTemplateSaveInput
): Promise<CampaignTemplateSaveResult> {
  const { Campaign } = getTenantClientModels(tenantConn)
  let html = String(input.templateHtml ?? '').trim()
  const linkId = String(input.emailTemplateId ?? '').trim()
  const currentId = input.currentEmailTemplateId ? String(input.currentEmailTemplateId) : ''
  const campaignId = input.campaignId ? String(input.campaignId) : undefined
  const tenantName = String(input.tenantName ?? '').trim()
  const recipientListId =
    String(input.recipientListId ?? '').trim() || CUSTOM_MARKETING_GCS_NO_LIST_FOLDER
  const ownership = emailTemplateOwnershipFromAuth(input.auth)

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
    html = ensureEmailTemplateUnsubscribe(html).html
    const htmlSource = resolveCampaignTemplateHtmlSource(input.templateHtmlSource)
    const saveToLibrary =
      htmlSource === 'custom' ? false : input.saveHtmlToLibrary === true

    if (
      currentId &&
      mongoose.isValidObjectId(currentId) &&
      (await isTemplateExclusiveToCampaign({
        EmailTemplate,
        Campaign: Campaign as CampaignModel,
        templateId: currentId,
        campaignId,
        auth: input.auth
      }))
    ) {
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
      saveToLibrary,
      ...ownership
    }).save()
    return { emailTemplateId: template._id.toString() }
  }

  if (linkId && mongoose.isValidObjectId(linkId)) {
    if (linkId === currentId) return { emailTemplateId: currentId }

    const source = await EmailTemplate.findOne(
      mergeEmailTemplateVisibilityFilter(
        { _id: linkId, ...ACTIVE_EMAIL_TEMPLATE_FILTER },
        input.auth
      )
    ).lean<EmailTemplateDoc | null>()
    if (!source) {
      throw createError({ statusCode: 400, message: 'Selected email template was not found' })
    }

    const copy = await new EmailTemplate({
      name: `${input.campaignName.trim()} - Template`,
      subject: source.subject?.trim() || input.subject?.trim() || input.campaignName.trim(),
      htmlTemplate: source.htmlTemplate ?? source.html ?? '',
      htmlSource: source.htmlSource ?? 'editor',
      saveToLibrary: false,
      ...ownership
    }).save()
    return { emailTemplateId: copy._id.toString() }
  }

  return {}
}
