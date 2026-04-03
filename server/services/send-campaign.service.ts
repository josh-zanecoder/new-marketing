import type { Connection } from 'mongoose'
import { getTenantClientModels, type TenantClientModels } from '../models/tenant/tenantClientModels'
import type {
  CampaignLean,
  CampaignMergeUserSnapshot,
  CampaignModel
} from '../types/tenant/campaign.model'
import type {
  CampaignRecipientInsertRow,
  CampaignRecipientLean,
  CampaignRecipientModel
} from '../types/tenant/campaignRecipient.model'
import type { EmailDynamicVariableModel } from '../types/tenant/emailDynamicVariable.model'
import type { EmailTemplateDoc, EmailTemplateModel } from '../types/tenant/emailTemplate.model'
import { isValidMarketingEmail, normalizeMarketingEmail } from '../helpers/marketingEmail'
import { enqueueCampaignBatch } from '../queue/emailQueue'
import {
  contactsByEmailForAudience,
  recipientEmailsForCampaign
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

export interface BeginCampaignSendOptions {
  /** Statuses from which this transition is allowed. Default `['Draft']`. */
  allowedStatuses?: readonly string[]
  /** If set, persisted on the campaign for {{ user.* }} merge in the worker. Omit to leave the existing snapshot. */
  mergeUserSnapshot?: CampaignMergeUserSnapshot | null
  /** Campaign `status` after rollback when enqueue fails. Default `Draft`. */
  statusOnEnqueueFailure?: string
}

export interface BeginCampaignSendResult {
  ok: true
  total: number
  valid: number
  invalid: number
  queued: number
  sent: number
  failed: number
  pending: number
}

/**
 * Builds recipient rows, moves the campaign to Sending, and enqueues batch processing.
 * Used by the send-now API and (later) the scheduled-send worker.
 */
export async function beginCampaignSend(
  conn: Connection,
  campaignId: string,
  options?: BeginCampaignSendOptions
): Promise<BeginCampaignSendResult> {
  const allowedStatuses = options?.allowedStatuses ?? ['Draft']
  const revertStatus = options?.statusOnEnqueueFailure ?? 'Draft'

  const dbName = conn.db?.databaseName
  if (!dbName) {
    throw createError({ statusCode: 500, message: 'Tenant connection has no database name' })
  }

  const models = getTenantClientModels(conn)
  const { Campaign, CampaignRecipient } = models

  const campaign = await (Campaign as CampaignModel).findById(campaignId).lean<CampaignLean | null>()
  if (!campaign) throw createError({ statusCode: 404, message: 'Campaign not found' })
  if (!allowedStatuses.includes(campaign.status)) {
    throw createError({ statusCode: 400, message: 'Campaign cannot be sent in its current status' })
  }

  const inFlight = await (CampaignRecipient as CampaignRecipientModel).countDocuments({
    campaign: campaignId,
    status: { $in: ['pending', 'sent'] }
  })
  if (inFlight > 0) {
    throw createError({ statusCode: 400, message: 'Campaign has already been queued for sending' })
  }

  await (CampaignRecipient as CampaignRecipientModel).deleteMany({ campaign: campaignId })

  const emails = await recipientEmailsForCampaign(conn, campaign)
  if (!emails.length) throw createError({ statusCode: 400, message: 'No recipients to send to' })

  const valid: string[] = []
  const invalid: string[] = []
  for (const email of emails) {
    if (isValidMarketingEmail(email)) valid.push(email)
    else invalid.push(email)
  }

  const rows: CampaignRecipientInsertRow[] = [
    ...valid.map(
      (email): CampaignRecipientInsertRow => ({
        campaign: campaignId,
        email,
        status: 'pending',
        clientId: ''
      })
    ),
    ...invalid.map(
      (email): CampaignRecipientInsertRow => ({
        campaign: campaignId,
        email,
        status: 'failed',
        clientId: '',
        error: 'Invalid email address'
      })
    )
  ]

  await (CampaignRecipient as CampaignRecipientModel).insertMany(rows)

  if (valid.length === 0) {
    // Scheduled sends: without this, status stays "Scheduled" forever (no batch job).
    if (campaign.status === 'Scheduled') {
      await (Campaign as CampaignModel).updateOne(
        { _id: campaignId },
        { $set: { status: 'Failed' }, $unset: { scheduledAt: 1 } }
      )
    }
    return {
      ok: true,
      total: emails.length,
      valid: 0,
      invalid: invalid.length,
      queued: 0,
      sent: 0,
      failed: invalid.length,
      pending: 0
    }
  }

  const snap = options?.mergeUserSnapshot
  await (Campaign as CampaignModel).updateOne(
    { _id: campaignId },
    {
      $set: {
        status: 'Sending',
        ...(snap ? { mergeUserSnapshot: snap } : {})
      }
    }
  )

  try {
    await enqueueCampaignBatch(campaignId, dbName)
  } catch (e: unknown) {
    await (CampaignRecipient as CampaignRecipientModel).deleteMany({ campaign: campaignId })
    await (Campaign as CampaignModel).updateOne({ _id: campaignId }, { status: revertStatus })
    console.error('[SendCampaign] Failed to enqueue:', e)
    throw createError({ statusCode: 503, message: 'Failed to queue campaign emails. Try again.' })
  }

  return {
    ok: true,
    total: emails.length,
    valid: valid.length,
    invalid: invalid.length,
    queued: valid.length,
    sent: 0,
    failed: invalid.length,
    pending: valid.length
  }
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

  // When the last batch finishes, recipients hit 0 pending before the worker's
  // campaign status flip (Sending → Sent/Failed). Re-read the campaign and only
  // report done once status has left Sending so clients don't stop polling early.
  let campaignStatus = campaign.status
  if (pendingCount === 0) {
    const fresh = await (Campaign as CampaignModel).findById(campaignId).lean<CampaignLean | null>()
    if (fresh) campaignStatus = fresh.status
  }

  return {
    campaignId,
    campaignStatus,
    pending: pendingCount,
    sent: sentCount,
    failed: failedCount,
    total: pendingCount + sentCount + failedCount,
    done: pendingCount === 0 && campaignStatus !== 'Sending'
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
