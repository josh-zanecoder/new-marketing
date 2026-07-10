import mongoose from 'mongoose'
import type { Connection } from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { CampaignLean, CampaignModel } from '@server/types/tenant/campaign.model'
import type { CampaignRecipientLean, CampaignRecipientModel } from '@server/types/tenant/campaignRecipient.model'
import type { ContactLean, ContactModel } from '@server/types/tenant/contact.model'
import type { EmailTemplateDoc, EmailTemplateModel } from '@server/types/tenant/emailTemplate.model'
import type { ManualRecipientLean, ManualRecipientModel } from '@server/types/tenant/manualRecipient.model'
import { withMarketableContactFilter } from '@server/utils/contact/marketableContact'
import { resolveRecipientListEmails } from '@server/utils/recipient/resolveRecipientListEmails'

export async function fetchAdminCampaignDetail(conn: Connection, campaignId: string) {
  const id = String(campaignId ?? '').trim()
  if (!id) throw createError({ statusCode: 400, message: 'Campaign ID is required' })

  const { Campaign, CampaignRecipient, ManualRecipient, EmailTemplate, Contact } =
    getTenantClientModels(conn)

  const campaign = await (Campaign as CampaignModel)
    .findOne({ _id: id })
    .select(
      '_id name sender recipientsType recipientsListId subject status scheduledAt emailTemplate mergeUserSnapshot replyTo createdAt updatedAt'
    )
    .lean<CampaignLean | null>()
  if (!campaign) throw createError({ statusCode: 404, message: 'Campaign not found' })

  let recipients: {
    email: string
    contactId?: string
    status?: string
    sentAt?: string
    error?: string
  }[] = []

  const campaignRecipients =
    campaign.status === 'Draft'
      ? []
      : await (CampaignRecipient as CampaignRecipientModel)
          .find({ campaign: campaign._id })
          .select('email status sentAt error')
          .sort({ status: 1, email: 1 })
          .lean<CampaignRecipientLean[]>()

  if (campaignRecipients.length) {
    recipients = campaignRecipients.map((r) => ({
      email: r.email,
      status: r.status,
      sentAt: r.sentAt ? new Date(r.sentAt).toISOString() : undefined,
      error: r.error
    }))
  } else if (
    campaign.recipientsType === 'list' &&
    String(campaign.recipientsListId ?? '').trim()
  ) {
    const emails = await resolveRecipientListEmails(conn, String(campaign.recipientsListId))
    recipients = emails.map((email) => ({ email }))
  } else if (campaign.recipientsType === 'manual' || campaign.recipientsType === 'list') {
    const docs = await (ManualRecipient as ManualRecipientModel)
      .find({ campaign: campaign._id })
      .select('contact')
      .lean<ManualRecipientLean[]>()
    const contactIds = docs.map((r) => r.contact).filter(Boolean) as mongoose.Types.ObjectId[]
    const uniqueIds = [...new Set(contactIds.map((cid) => String(cid)))].map(
      (s) => new mongoose.Types.ObjectId(s)
    )
    const contacts =
      uniqueIds.length > 0
        ? await (Contact as ContactModel)
            .find(withMarketableContactFilter({ _id: { $in: uniqueIds } }))
            .select('email')
            .lean<ContactLean[]>()
        : []
    const emailByContactId = new Map<string, string>(
      contacts.map((c) => [String(c._id), (c.email ?? '').trim().toLowerCase()])
    )
    recipients = docs
      .map((r) => ({
        email: emailByContactId.get(String(r.contact)) ?? '',
        contactId: String(r.contact)
      }))
      .filter((r) => r.email.trim().length > 0)
  }

  recipients = recipients.filter((r) => (r.email ?? '').trim().length > 0)

  let emailTemplate: { html: string; name: string } | null = null
  let templateHtml: string | null = null
  let templateHtmlSource: 'editor' | 'upload' = 'editor'
  let linkedTemplate: EmailTemplateDoc | null = null
  if (campaign.emailTemplate) {
    linkedTemplate = await (EmailTemplate as EmailTemplateModel)
      .findById(campaign.emailTemplate)
      .lean<EmailTemplateDoc | null>()
    if (linkedTemplate) {
      const rawHtml = linkedTemplate.htmlTemplate ?? linkedTemplate.html ?? ''
      emailTemplate = { name: linkedTemplate.name, html: rawHtml }
      templateHtmlSource =
        linkedTemplate.htmlSource === 'upload' ? 'upload' : 'editor'
      templateHtml = linkedTemplate.css ? `<style>${linkedTemplate.css}</style>${rawHtml}` : rawHtml
    }
  }

  const saveHtmlToLibrary = linkedTemplate
    ? linkedTemplate.saveToLibrary !== false
    : undefined

  return {
    campaign: {
      id: String(campaign._id),
      name: campaign.name,
      sender: campaign.sender,
      recipientsType: campaign.recipientsType,
      recipientsListId: campaign.recipientsListId,
      subject: campaign.subject,
      status: campaign.status,
      scheduledAt: campaign.scheduledAt
        ? new Date(campaign.scheduledAt).toISOString()
        : undefined,
      recipients,
      emailTemplate,
      emailTemplateId: linkedTemplate ? String(campaign.emailTemplate) : undefined,
      templateHtml,
      templateHtmlSource,
      saveHtmlToLibrary,
      mergeUserSnapshot: campaign.mergeUserSnapshot,
      replyTo: campaign.replyTo,
      createdAt: campaign.createdAt
        ? new Date(campaign.createdAt).toISOString()
        : '',
      updatedAt: campaign.updatedAt
        ? new Date(campaign.updatedAt).toISOString()
        : ''
    }
  }
}
