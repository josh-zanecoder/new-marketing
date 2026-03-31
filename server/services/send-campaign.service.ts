import type { TenantClientModels } from '../models/tenant/tenantClientModels'
import type { CampaignLean, CampaignModel } from '../types/tenant/campaign.model'
import type { CampaignRecipientLean, CampaignRecipientModel } from '../types/tenant/campaignRecipient.model'
import type { EmailTemplateDoc, EmailTemplateModel } from '../types/tenant/emailTemplate.model'
import { sendEmail } from './brevo.service'
import {
  mergeMustacheTemplate,
  mergeRootWithUserSnapshot
} from '../../app/utils/emailTemplateMerge'

const BATCH_SIZE = 25

export interface ProcessBatchResult {
  campaignId: string
  campaignStatus: string
  pending: number
  sent: number
  failed: number
  total: number
  done: boolean
}

/** Read-only progress for API polling (sending happens in the BullMQ worker). */
export async function getCampaignSendProgress(
  models: TenantClientModels,
  campaignId: string
): Promise<ProcessBatchResult> {
  const { Campaign, CampaignRecipient } = models
  const campaign = await (Campaign as CampaignModel)
    .findById(campaignId)
    .lean<CampaignLean | null>()
  if (!campaign) {
    throw createError({ statusCode: 404, message: 'Campaign not found' })
  }

  const [pendingCount, sentCount, failedCount] = await Promise.all([
    (CampaignRecipient as CampaignRecipientModel).countDocuments({
      campaign: campaignId,
      status: 'pending'
    }),
    (CampaignRecipient as CampaignRecipientModel).countDocuments({
      campaign: campaignId,
      status: 'sent'
    }),
    (CampaignRecipient as CampaignRecipientModel).countDocuments({
      campaign: campaignId,
      status: 'failed'
    })
  ])

  return {
    campaignId,
    campaignStatus: campaign.status,
    pending: pendingCount,
    sent: sentCount,
    failed: failedCount,
    total: pendingCount + sentCount + failedCount,
    done: pendingCount === 0
  }
}

/** Processes up to BATCH_SIZE pending recipients (invoked by the email worker). */
export async function processBatch(
  models: TenantClientModels,
  campaignId: string
): Promise<ProcessBatchResult> {
  const { Campaign, CampaignRecipient, EmailTemplate } = models
  const campaign = await (Campaign as CampaignModel)
    .findById(campaignId)
    .lean<CampaignLean | null>()
  if (!campaign) {
    throw createError({ statusCode: 404, message: 'Campaign not found' })
  }

  let templateHtml: string | null = null
  if (campaign.emailTemplate) {
    const template = await (EmailTemplate as EmailTemplateModel)
      .findById(campaign.emailTemplate)
      .lean<EmailTemplateDoc | null>()
    if (template) {
      templateHtml = template.htmlTemplate ?? template.html ?? null
    }
  }

  const pending = await (CampaignRecipient as CampaignRecipientModel)
    .find({ campaign: campaignId, status: 'pending' })
    .limit(BATCH_SIZE)
    .lean<CampaignRecipientLean[]>()

  if (pending.length > 0 && (!templateHtml || !campaign.sender?.email)) {
    console.warn('[SendCampaign] Missing template or sender:', {
      campaignId,
      hasTemplate: !!templateHtml,
      sender: campaign.sender?.email
    })
  }

  for (const r of pending) {
    if (!templateHtml || !campaign.sender?.email) {
      await (CampaignRecipient as CampaignRecipientModel).updateOne(
        { _id: r._id },
        { status: 'failed', error: 'Missing email template or sender' }
      )
      continue
    }

    const mergeRoot = mergeRootWithUserSnapshot(campaign.mergeUserSnapshot)
    const subjectRendered = mergeMustacheTemplate(
      campaign.subject || '(No subject)',
      mergeRoot
    )
    const htmlRendered = mergeMustacheTemplate(templateHtml, mergeRoot)

    const result = await sendEmail({
      sender: campaign.sender,
      to: [{ email: r.email }],
      subject: subjectRendered,
      htmlContent: htmlRendered,
      tags: [`campaign:${campaignId}`]
    })

    if (result.error) {
      await (CampaignRecipient as CampaignRecipientModel).updateOne(
        { _id: r._id },
        { status: 'failed', error: result.error }
      )
    } else {
      await (CampaignRecipient as CampaignRecipientModel).updateOne(
        { _id: r._id },
        { status: 'sent', sentAt: new Date() }
      )
    }
  }

  const [pendingCount, sentCount, failedCount] = await Promise.all([
    (CampaignRecipient as CampaignRecipientModel).countDocuments({
      campaign: campaignId,
      status: 'pending'
    }),
    (CampaignRecipient as CampaignRecipientModel).countDocuments({
      campaign: campaignId,
      status: 'sent'
    }),
    (CampaignRecipient as CampaignRecipientModel).countDocuments({
      campaign: campaignId,
      status: 'failed'
    })
  ])

  if (pendingCount === 0) {
    const total = sentCount + failedCount
    const newStatus = failedCount === total ? 'Failed' : 'Sent'
    await (Campaign as CampaignModel).updateOne({ _id: campaignId }, { status: newStatus })
  }

  const campaignUpdated = await (Campaign as CampaignModel)
    .findById(campaignId)
    .lean<CampaignLean | null>()
  if (!campaignUpdated) {
    throw createError({ statusCode: 404, message: 'Campaign not found' })
  }

  return {
    campaignId,
    campaignStatus: campaignUpdated.status,
    pending: pendingCount,
    sent: sentCount,
    failed: failedCount,
    total: pendingCount + sentCount + failedCount,
    done: pendingCount === 0
  }
}
