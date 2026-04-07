import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { CampaignLean, CampaignModel } from '@server/types/tenant/campaign.model'
import type { CampaignRecipientLean, CampaignRecipientModel } from '@server/types/tenant/campaignRecipient.model'
import type { ContactLean, ContactModel } from '@server/types/tenant/contact.model'
import type { EmailTemplateDoc, EmailTemplateModel } from '@server/types/tenant/emailTemplate.model'
import type { ManualRecipientLean, ManualRecipientModel } from '@server/types/tenant/manualRecipient.model'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'
import { resolveRecipientListEmails } from '@server/utils/recipient/resolveRecipientListEmails'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Campaign ID is required' })

  const conn = await getTenantConnectionFromEvent(event)
  const { Campaign, CampaignRecipient, ManualRecipient, EmailTemplate, Contact } =
    getTenantClientModels(conn)

  const campaign = await (Campaign as CampaignModel)
    .findOne(mergeTenantOwnerEmailScopeFilter({ _id: id }, event.context.auth))
    .select(
      '_id name sender recipientsType recipientsListId subject status scheduledAt emailTemplate mergeUserSnapshot createdAt updatedAt'
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
    // Live list membership + active contacts only (avoids stale ManualRecipient count after contact delete)
    const emails = await resolveRecipientListEmails(conn, String(campaign.recipientsListId))
    recipients = emails.map((email) => ({ email }))
  } else if (campaign.recipientsType === 'manual' || campaign.recipientsType === 'list') {
    const docs = await (ManualRecipient as ManualRecipientModel)
      .find({ campaign: campaign._id })
      .select('contact')
      .lean<ManualRecipientLean[]>()
    const contactIds = docs.map((r) => r.contact).filter(Boolean) as mongoose.Types.ObjectId[]
    const uniqueIds = [...new Set(contactIds.map((id) => String(id)))].map(
      (s) => new mongoose.Types.ObjectId(s)
    )
    const contacts =
      uniqueIds.length > 0
        ? await (Contact as ContactModel)
            .find({ _id: { $in: uniqueIds }, deletedAt: null })
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
  if (campaign.emailTemplate) {
    const template = await (EmailTemplate as EmailTemplateModel)
      .findById(campaign.emailTemplate)
      .lean<EmailTemplateDoc | null>()
    if (template) {
      const rawHtml = template.htmlTemplate ?? template.html ?? ''
      emailTemplate = { name: template.name, html: rawHtml }
      // Support legacy docs with separate css field
      templateHtml = template.css ? `<style>${template.css}</style>${rawHtml}` : rawHtml
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
      scheduledAt: campaign.scheduledAt
        ? new Date(campaign.scheduledAt).toISOString()
        : undefined,
      recipients,
      emailTemplate,
      templateHtml,
      mergeUserSnapshot: campaign.mergeUserSnapshot,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt
    }
  }
})
