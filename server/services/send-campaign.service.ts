import type { TenantClientModels } from '../models/tenant/tenantClientModels'
import type { CampaignLean, CampaignModel } from '../types/tenant/campaign.model'
import type { CampaignRecipientLean, CampaignRecipientModel } from '../types/tenant/campaignRecipient.model'
import type { EmailDynamicVariableModel } from '../types/tenant/emailDynamicVariable.model'
import type { EmailTemplateDoc, EmailTemplateModel } from '../types/tenant/emailTemplate.model'
import { normalizeMarketingEmail } from '../helpers/marketingEmail'
import {
  contactsByEmailForAudience
} from '../utils/emailMerge/campaignAudience'
import {
  composeEmailMergeRoot,
  fetchEnabledEmailDynamicVariableBindings
} from '../utils/emailMerge/composeMergeRoot'
import { sendEmail } from './brevo.service'
import { mergeMustacheTemplate } from '~~/shared/utils/emailTemplateMerge'

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
  const { Campaign, CampaignRecipient, EmailTemplate, EmailDynamicVariable } = models
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
      const rawHtml = template.htmlTemplate ?? template.html ?? null
      templateHtml =
        rawHtml && template.css?.trim()
          ? `<style>${template.css}</style>${rawHtml}`
          : rawHtml
    }
  }

  const pending = await (CampaignRecipient as CampaignRecipientModel)
    .find({ campaign: campaignId, status: 'pending' })
    .limit(BATCH_SIZE)
    .lean<CampaignRecipientLean[]>()

  const contactByEmail = await contactsByEmailForAudience(
    models,
    campaign,
    pending.map((r) => r.email)
  )

  const dynamicVariableBindings = await fetchEnabledEmailDynamicVariableBindings(
    EmailDynamicVariable as EmailDynamicVariableModel
  )

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

    const emailKey = normalizeMarketingEmail(r.email)
    const contact = emailKey ? contactByEmail.get(emailKey) : undefined
    const mergeRoot = composeEmailMergeRoot(
      campaign.mergeUserSnapshot,
      contact ?? null,
      dynamicVariableBindings
    )
    const toEmail = (r.email ?? '').trim()
    if (toEmail) {
      const cur = mergeRoot.recipient
      const curObj =
        cur != null && typeof cur === 'object' && !Array.isArray(cur)
          ? (cur as Record<string, unknown>)
          : {}
      if (!String(curObj.email ?? '').trim()) {
        mergeRoot.recipient = { ...curObj, email: toEmail }
      }
    }
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
