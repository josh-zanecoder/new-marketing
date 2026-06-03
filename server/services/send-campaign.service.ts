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
import { getRegistryConnection } from '../lib/mongoose'
import { findRegistryTenantByDbName } from '../tenant/registry-auth'
import { mergeTenantOwnerEmailScopeFilter } from '../utils/contactOwnerFilter'
import { sendEmail } from './brevo.service'
import { mergeMustacheTemplate } from '~~/shared/utils/emailTemplateMerge'

const BATCH_SIZE = 25
const SEND_CONCURRENCY = 5

function logSend(event: string, details: Record<string, unknown>) {
  console.log(`[SendCampaign] ${event}`, details)
}

function logSendWarn(event: string, details: Record<string, unknown>) {
  console.warn(`[SendCampaign] ${event}`, details)
}

function logSendError(event: string, details: Record<string, unknown>) {
  console.error(`[SendCampaign] ${event}`, details)
}

export async function finalizeCampaignSendIfComplete(
  models: TenantClientModels,
  campaignId: string
): Promise<{ finalized: boolean; status?: string; pending?: number; sent?: number; failed?: number }> {
  const { Campaign, CampaignRecipient } = models
  const campaign = await (Campaign as CampaignModel)
    .findById(campaignId)
    .select('status')
    .lean<Pick<CampaignLean, 'status'> | null>()
  if (!campaign || campaign.status !== 'Sending') {
    return { finalized: false }
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

  if (pendingCount > 0) {
    return { finalized: false, pending: pendingCount, sent: sentCount, failed: failedCount }
  }

  const total = sentCount + failedCount
  const newStatus = total === 0 || failedCount === total ? 'Failed' : 'Sent'
  await (Campaign as CampaignModel).updateOne(
    { _id: campaignId },
    { $set: { status: newStatus }, $unset: { scheduledAt: 1 } }
  )
  logSend('finalized', { campaignId, newStatus, sent: sentCount, failed: failedCount })
  return {
    finalized: true,
    status: newStatus,
    pending: pendingCount,
    sent: sentCount,
    failed: failedCount
  }
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next
      next += 1
      if (i >= items.length) return
      out[i] = await mapper(items[i] as T, i)
    }
  })
  await Promise.all(workers)
  return out
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

export interface BeginCampaignSendOptions {
  /** Statuses from which this transition is allowed. Default `['Draft']`. */
  allowedStatuses?: readonly string[]
  /** If set, persisted on the campaign for {{ user.* }} merge in the worker. Omit to leave the existing snapshot. */
  mergeUserSnapshot?: CampaignMergeUserSnapshot | null
  /** Campaign `status` after rollback when enqueue fails. Default `Draft`. */
  statusOnEnqueueFailure?: string
  /** Tenant HTTP auth: restricts load/update to campaigns visible under owner-email scope. Workers omit this. */
  auth?: unknown
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

  const campaignScope = mergeTenantOwnerEmailScopeFilter(
    { _id: campaignId },
    options?.auth
  )

  const campaign = await (Campaign as CampaignModel)
    .findOne(campaignScope)
    .lean<CampaignLean | null>()
  if (!campaign) throw createError({ statusCode: 404, message: 'Campaign not found' })
  if (!allowedStatuses.includes(campaign.status)) {
    throw createError({ statusCode: 400, message: 'Campaign cannot be sent in its current status' })
  }

  logSend('begin', {
    campaignId,
    dbName,
    status: campaign.status,
    allowedStatuses: [...allowedStatuses]
  })

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
    await (Campaign as CampaignModel).updateOne(campaignScope, {
      $set: { status: 'Failed' },
      $unset: { scheduledAt: 1 }
    })
    logSendWarn('noValidRecipients', {
      campaignId,
      dbName,
      total: emails.length,
      invalid: invalid.length
    })
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
  await (Campaign as CampaignModel).updateOne(campaignScope, {
    $set: {
      status: 'Sending',
      ...(snap ? { mergeUserSnapshot: snap } : {})
    }
  })

  try {
    await enqueueCampaignBatch(campaignId, dbName)
  } catch (e: unknown) {
    await (CampaignRecipient as CampaignRecipientModel).deleteMany({ campaign: campaignId })
    await (Campaign as CampaignModel).updateOne(campaignScope, { status: revertStatus })
    logSendError('enqueueFailed', {
      campaignId,
      dbName,
      revertStatus,
      error: e instanceof Error ? e.message : String(e)
    })
    throw createError({ statusCode: 503, message: 'Failed to queue campaign emails. Try again.' })
  }

  logSend('queued', {
    campaignId,
    dbName,
    valid: valid.length,
    invalid: invalid.length
  })

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
  campaignId: string,
  auth?: unknown
): Promise<ProcessBatchResult> {
  const { Campaign, CampaignRecipient } = models
  const campaignScope = mergeTenantOwnerEmailScopeFilter({ _id: campaignId }, auth)
  const campaign = await (Campaign as CampaignModel)
    .findOne(campaignScope)
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
    const fresh = await (Campaign as CampaignModel)
      .findOne(campaignScope)
      .lean<CampaignLean | null>()
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

  if (pending.length === 0) {
    const finalized = await finalizeCampaignSendIfComplete(models, campaignId)
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
    const campaignUpdated = await (Campaign as CampaignModel)
      .findById(campaignId)
      .lean<CampaignLean | null>()
    if (!campaignUpdated) {
      throw createError({ statusCode: 404, message: 'Campaign not found' })
    }
    if (finalized.finalized) {
      logSend('batchComplete.noPending', {
        campaignId,
        status: campaignUpdated.status,
        sent: sentCount,
        failed: failedCount
      })
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

  logSend('batchStart', {
    campaignId,
    batchSize: pending.length,
    status: campaign.status
  })

  const [contactByEmail, dynamicVariableBindings] = await Promise.all([
    contactsByEmailForAudience(
      models,
      campaign,
      pending.map((r) => r.email)
    ),
    fetchEnabledEmailDynamicVariableBindings(EmailDynamicVariable as EmailDynamicVariableModel)
  ])

  if (pending.length > 0 && (!templateHtml || !campaign.sender?.email)) {
    logSendWarn('missingTemplateOrSender', {
      campaignId,
      hasTemplate: !!templateHtml,
      sender: campaign.sender?.email
    })
  }

  const tenantDbNameForTags = (Campaign as CampaignModel).db?.db?.databaseName
  let brevoTenantTagValue: string | undefined
  if (tenantDbNameForTags) {
    brevoTenantTagValue = tenantDbNameForTags
    try {
      const registry = await getRegistryConnection()
      const row = await findRegistryTenantByDbName(registry, tenantDbNameForTags)
      const tid = row?.tenantId?.trim()
      if (tid) brevoTenantTagValue = tid
    } catch (err) {
      console.warn('[SendCampaign] registry lookup for Brevo tenant tag failed', {
        dbName: tenantDbNameForTags,
        err
      })
    }
  }

  if (!templateHtml || !campaign.sender?.email) {
    await (CampaignRecipient as CampaignRecipientModel).updateMany(
      { _id: { $in: pending.map((r) => r._id) } },
      { $set: { status: 'failed', error: 'Missing email template or sender' } }
    )
  } else {
    const snap = campaign.mergeUserSnapshot
    const userForTag =
      snap?.email?.trim() ||
      [snap?.firstName, snap?.lastName].filter(Boolean).join(' ').trim() ||
      undefined

    const ops = await mapWithConcurrency(pending, SEND_CONCURRENCY, async (r) => {
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
        tags: [`campaign:${campaignId}`],
        ...(tenantDbNameForTags && brevoTenantTagValue
          ? { tenantId: brevoTenantTagValue, dbName: tenantDbNameForTags }
          : {}),
        ...(userForTag ? { user: userForTag } : {})
      })

      return result.error
        ? {
            updateOne: {
              filter: { _id: r._id },
              update: { status: 'failed', error: result.error }
            }
          }
        : {
            updateOne: {
              filter: { _id: r._id },
              update: { status: 'sent', sentAt: new Date() }
            }
          }
    })
    if (ops.length) {
      await (CampaignRecipient as CampaignRecipientModel).bulkWrite(ops, { ordered: false })
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
    await finalizeCampaignSendIfComplete(models, campaignId)
  }

  const campaignUpdated = await (Campaign as CampaignModel)
    .findById(campaignId)
    .lean<CampaignLean | null>()
  if (!campaignUpdated) {
    throw createError({ statusCode: 404, message: 'Campaign not found' })
  }

  logSend('batchDone', {
    campaignId,
    pending: pendingCount,
    sent: sentCount,
    failed: failedCount,
    campaignStatus: campaignUpdated.status,
    done: pendingCount === 0
  })

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
