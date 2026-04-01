import type { TenantClientModels } from '../models/tenant/tenantClientModels'
import type { CampaignLean, CampaignModel } from '../types/tenant/campaign.model'
import type { CampaignRecipientLean, CampaignRecipientModel } from '../types/tenant/campaignRecipient.model'
import type { ContactLean, ContactModel } from '../types/tenant/contact.model'
import type { EmailDynamicVariableModel } from '../types/tenant/emailDynamicVariable.model'
import type { EmailTemplateDoc, EmailTemplateModel } from '../types/tenant/emailTemplate.model'
import { normalizeMarketingEmail } from '../helpers/marketingEmail'
import { buildEmailMergeRoot, loadEnabledDynamicVariableInputs } from '../utils/buildEmailMergeRoot'
import { sendEmail } from './brevo.service'
import { mergeMustacheTemplate } from '../../app/utils/emailTemplateMerge'

const BATCH_SIZE = 25

function contactKindRank(k: string): number {
  const order: Record<string, number> = { client: 0, prospect: 1, contact: 2 }
  return order[k] ?? 3
}

function pickPreferredContact(a: ContactLean, b: ContactLean): ContactLean {
  const ra = contactKindRank(a.contactKind)
  const rb = contactKindRank(b.contactKind)
  if (ra !== rb) return ra < rb ? a : b
  const ta = a.updatedAt?.getTime() ?? 0
  const tb = b.updatedAt?.getTime() ?? 0
  return ta >= tb ? a : b
}

async function loadContactsByEmail(
  Contact: ContactModel,
  emails: string[]
): Promise<Map<string, ContactLean>> {
  const normalized = [...new Set(emails.map((e) => normalizeMarketingEmail(e)).filter(Boolean))]
  if (!normalized.length) return new Map()
  const docs = await Contact.find({
    deletedAt: null,
    $expr: {
      $in: [
        { $toLower: { $trim: { input: { $ifNull: ['$email', ''] } } } },
        normalized
      ]
    }
  })
    .lean<ContactLean[]>()
  const map = new Map<string, ContactLean>()
  for (const c of docs) {
    const key = normalizeMarketingEmail(c.email)
    if (!key) continue
    const prev = map.get(key)
    map.set(key, prev ? pickPreferredContact(prev, c) : c)
  }
  return map
}

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
  const { Campaign, CampaignRecipient, EmailTemplate, Contact, EmailDynamicVariable } = models
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

  const contactByEmail = await loadContactsByEmail(
    Contact as ContactModel,
    pending.map((r) => r.email)
  )

  const dynamicVariables = await loadEnabledDynamicVariableInputs(
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
    const mergeRoot = buildEmailMergeRoot(
      campaign.mergeUserSnapshot,
      contact ?? null,
      dynamicVariables
    )
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
