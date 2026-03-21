import { getTenantClientModels } from '../../../models/tenant/tenantClientModels'
import type { CampaignLean, CampaignModel } from '../../../types/tenant/campaign.model'
import type { CampaignRecipientLean, CampaignRecipientModel } from '../../../types/tenant/campaignRecipient.model'
import type { EmailTemplateDoc, EmailTemplateModel } from '../../../types/tenant/emailTemplate.model'
import type { ManualRecipientLean, ManualRecipientModel } from '../../../types/tenant/manualRecipient.model'
import { getTenantConnectionFromEvent } from '../../../tenant/connection'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Campaign ID is required' })

  const conn = await getTenantConnectionFromEvent(event)
  const { Campaign, CampaignRecipient, ManualRecipient, EmailTemplate } =
    getTenantClientModels(conn)

  const campaign = await (Campaign as CampaignModel)
    .findById(id)
    .lean<CampaignLean | null>()
  if (!campaign) throw createError({ statusCode: 404, message: 'Campaign not found' })

  let recipients: { email: string; status?: string; sentAt?: string; error?: string }[] = []
  const campaignRecipients = await (CampaignRecipient as CampaignRecipientModel)
    .find({ campaign: campaign._id })
    .lean<CampaignRecipientLean[]>()
  if (campaignRecipients.length) {
    recipients = campaignRecipients.map((r) => ({
      email: r.email,
      status: r.status,
      sentAt: r.sentAt ? new Date(r.sentAt).toISOString() : undefined,
      error: r.error
    }))
  } else if (campaign.recipientsType === 'manual') {
    const docs = await (ManualRecipient as ManualRecipientModel)
      .find({ campaign: campaign._id })
      .lean<ManualRecipientLean[]>()
    recipients = docs.map((r) => ({ email: r.email }))
  }

  let emailTemplate: { html: string; name: string } | null = null
  let templateHtml: string | null = null
  if (campaign.emailTemplate) {
    const template = await (EmailTemplate as EmailTemplateModel)
      .findById(campaign.emailTemplate)
      .lean<EmailTemplateDoc | null>()
    if (template) {
      emailTemplate = { name: template.name, html: template.html }
      // Support legacy docs with separate css field
      templateHtml = template.css ? `<style>${template.css}</style>${template.html}` : template.html
    }
  }

  return {
    campaign: {
      id: String(campaign._id),
      name: campaign.name,
      sender: campaign.sender,
      recipientsType: campaign.recipientsType,
      recipientsListId: campaign.recipientsListId,
      subject: campaign.subject,
      status: campaign.status,
      recipients,
      emailTemplate,
      templateHtml,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt
    }
  }
})
