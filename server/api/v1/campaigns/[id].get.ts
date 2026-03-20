import type { Model } from 'mongoose'
import { Campaign } from '../../../models/Campaign'
import { CampaignRecipient } from '../../../models/CampaignRecipient'
import { EmailTemplate } from '../../../models/EmailTemplate'
import { ManualRecipient } from '../../../models/ManualRecipients'
import { getRegistryConnection } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Campaign ID is required' })

  await getRegistryConnection()

  const campaign = await (Campaign as Model<any>).findById(id).lean() as any
  if (!campaign) throw createError({ statusCode: 404, message: 'Campaign not found' })

  let recipients: { email: string; status?: string; sentAt?: string; error?: string }[] = []
  const campaignRecipients = await (CampaignRecipient as Model<any>).find({ campaign: campaign._id }).lean() as any[]
  if (campaignRecipients.length) {
    recipients = campaignRecipients.map((r) => ({
      email: r.email,
      status: r.status,
      sentAt: r.sentAt ? new Date(r.sentAt).toISOString() : undefined,
      error: r.error
    }))
  } else if (campaign.recipientsType === 'manual') {
    const docs = await (ManualRecipient as Model<any>).find({ campaign: campaign._id }).lean()
    recipients = (docs as any[]).map((r) => ({ email: r.email }))
  }

  let emailTemplate: { html: string; name: string } | null = null
  let templateHtml: string | null = null
  if (campaign.emailTemplate) {
    const template = await (EmailTemplate as Model<any>).findById(campaign.emailTemplate).lean() as any
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
