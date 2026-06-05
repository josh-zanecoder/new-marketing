import { randomUUID } from 'node:crypto'
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
  applyDefaultUnsubscribeMergeValue,
  composeEmailMergeRoot,
  fetchEnabledEmailDynamicVariableBindings
} from '../utils/emailMerge/composeMergeRoot'
import { getRegistryConnection } from '../lib/mongoose'
import { findRegistryTenantByDbName } from '../tenant/registry-auth'
import { mergeTenantOwnerEmailScopeFilter } from '../utils/contactOwnerFilter'
import { buildCampaignReplyTo } from '@server/utils/email/replyToFromContactMetadata'
import { sendCampaignBatchWithMessageVersions } from './brevo.service'
import { mergeMustacheTemplate } from '~~/shared/utils/emailTemplateMerge'
import { campaignBatchBrevoIdempotencyKey } from '../utils/campaignSend/campaignBatchBrevoIdempotencyKey'
import { claimCampaignRecipientBatch } from '../utils/campaignSend/claimCampaignRecipientBatch'
import {
  CAMPAIGN_RECIPIENT_STATUS_FAILED,
  CAMPAIGN_RECIPIENT_STATUS_PENDING,
  CAMPAIGN_RECIPIENT_STATUS_SENDING,
  CAMPAIGN_RECIPIENT_STATUS_SENT,
  CAMPAIGN_SEND_BATCH_SIZE,
  CAMPAIGN_SEND_RECONCILE_ACK_SENDING_MS_DEFAULT,
  CAMPAIGN_SEND_STALE_SENDING_MS_DEFAULT
} from '../utils/campaignSend/constants'
import { campaignSendJobShouldSkip } from '../utils/campaignSend/campaignSendJobGuard'
import type { CampaignBatchMessageVersion } from '../utils/campaignSend/buildCampaignBrevoBatchRequest'

const MISSING_BREVO_ID_MESSAGE =
  'Brevo did not return a message id for this recipient (partial or empty API response).'

function logSend(event: string, details: Record<string, unknown>) {
  console.log(`[SendCampaign] ${event}`, details)
}

function logSendWarn(event: string, details: Record<string, unknown>) {
  console.warn(`[SendCampaign] ${event}`, details)
}

function logSendError(event: string, details: Record<string, unknown>) {
  console.error(`[SendCampaign] ${event}`, details)
}

function staleSendingCutoff(maxAgeMs?: number): Date {
  const staleMs = Math.max(
    60_000,
    Number(
      maxAgeMs ??
        process.env.CAMPAIGN_SEND_STALE_SENDING_MS ??
        CAMPAIGN_SEND_STALE_SENDING_MS_DEFAULT
    )
  )
  return new Date(Date.now() - staleMs)
}

function reconcileAckSendingCutoff(): Date {
  const ms = Math.max(
    60_000,
    Number(
      process.env.CAMPAIGN_SEND_RECONCILE_ACK_SENDING_MS ??
        CAMPAIGN_SEND_RECONCILE_ACK_SENDING_MS_DEFAULT
    )
  )
  return new Date(Date.now() - ms)
}

/**
 * Worker finished at Brevo but never updated Mongo (crash / concurrent tail jobs).
 * Mark old `sending` rows as `sent` so finalize can run without re-sending.
 */
export async function ackStaleInFlightSendingRecipients(
  models: TenantClientModels,
  campaignId: string
): Promise<number> {
  const { CampaignRecipient } = models
  const cutoff = reconcileAckSendingCutoff()
  const res = await (CampaignRecipient as CampaignRecipientModel).updateMany(
    {
      campaign: campaignId,
      status: CAMPAIGN_RECIPIENT_STATUS_SENDING,
      updatedAt: { $lt: cutoff }
    },
    {
      $set: { status: CAMPAIGN_RECIPIENT_STATUS_SENT, sentAt: new Date() },
      $unset: { error: 1 }
    }
  )
  const n = res.modifiedCount ?? 0
  if (n > 0) {
    logSend('reconcileAckSending', { campaignId, count: n })
  }
  return n
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
      status: { $in: [CAMPAIGN_RECIPIENT_STATUS_PENDING, CAMPAIGN_RECIPIENT_STATUS_SENDING] }
    }),
    (CampaignRecipient as CampaignRecipientModel).countDocuments({
      campaign: campaignId,
      status: CAMPAIGN_RECIPIENT_STATUS_SENT
    }),
    (CampaignRecipient as CampaignRecipientModel).countDocuments({
      campaign: campaignId,
      status: CAMPAIGN_RECIPIENT_STATUS_FAILED
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

export async function clearStaleSendingRecipients(
  models: TenantClientModels,
  campaignId: string,
  recipientIds?: string[]
): Promise<number> {
  const { CampaignRecipient } = models
  const cutoff = staleSendingCutoff()
  const filter: Record<string, unknown> = {
    campaign: campaignId,
    status: CAMPAIGN_RECIPIENT_STATUS_SENDING,
    updatedAt: { $lt: cutoff }
  }
  if (recipientIds?.length) {
    filter._id = { $in: recipientIds }
  }
  const staleMs = Date.now() - cutoff.getTime()
  const res = await (CampaignRecipient as CampaignRecipientModel).updateMany(filter, {
    $set: {
      status: CAMPAIGN_RECIPIENT_STATUS_FAILED,
      error: `Send stalled longer than ${staleMs}ms (cleared for retry).`
    },
    $unset: { brevoMessageId: 1 }
  })
  return res.modifiedCount ?? 0
}

export interface ProcessBatchResult {
  campaignId: string
  campaignStatus: string
  pending: number
  sent: number
  failed: number
  total: number
  done: boolean
  skipped?: boolean
  /** When false, worker must not enqueue the next page (in-flight `sending` only). */
  chainNext?: boolean
  /** Recipients claimed and processed in this job (drives page chaining). */
  processedInBatch?: number
}

function recipientBrevoParams(contact: {
  firstName?: string | null
  lastName?: string | null
} | null | undefined): Record<string, string> | undefined {
  const firstName = String(contact?.firstName ?? '').trim()
  const lastName = String(contact?.lastName ?? '').trim()
  if (!firstName && !lastName) return undefined
  return { firstName, lastName }
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
  /**
   * `new` — rebuild recipient rows from audience (default).
   * `retry_failed` — keep delivery ledger; only resend non-`sent` rows (failed/pending).
   */
  mode?: 'new' | 'retry_failed'
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
  sendRunId: string
  resumed?: boolean
}

/**
 * Builds recipient rows, moves the campaign to Sending, and enqueues batch processing.
 * Used by the send-now API and the scheduled-send worker.
 */
export async function beginCampaignSend(
  conn: Connection,
  campaignId: string,
  options?: BeginCampaignSendOptions
): Promise<BeginCampaignSendResult> {
  const mode = options?.mode ?? 'new'
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

  const sendRunId = randomUUID()

  logSend('begin', {
    campaignId,
    dbName,
    status: campaign.status,
    mode,
    sendRunId,
    allowedStatuses: [...allowedStatuses]
  })

  if (mode === 'retry_failed') {
    const [retryable, sentCount, failedCount] = await Promise.all([
      (CampaignRecipient as CampaignRecipientModel).countDocuments({
        campaign: campaignId,
        status: { $in: [CAMPAIGN_RECIPIENT_STATUS_PENDING, CAMPAIGN_RECIPIENT_STATUS_FAILED] }
      }),
      (CampaignRecipient as CampaignRecipientModel).countDocuments({
        campaign: campaignId,
        status: CAMPAIGN_RECIPIENT_STATUS_SENT
      }),
      (CampaignRecipient as CampaignRecipientModel).countDocuments({
        campaign: campaignId,
        status: CAMPAIGN_RECIPIENT_STATUS_FAILED
      })
    ])
    if (retryable === 0) {
      throw createError({
        statusCode: 400,
        message: 'No failed or pending recipients to retry'
      })
    }
    const inFlightSending = await (CampaignRecipient as CampaignRecipientModel).countDocuments({
      campaign: campaignId,
      status: CAMPAIGN_RECIPIENT_STATUS_SENDING
    })
    if (inFlightSending > 0) {
      throw createError({
        statusCode: 400,
        message: 'Campaign send is still in progress'
      })
    }

    const snap = options?.mergeUserSnapshot
    await (Campaign as CampaignModel).updateOne(campaignScope, {
      $set: {
        status: 'Sending',
        sendRunId,
        sendPage: 0,
        ...(snap ? { mergeUserSnapshot: snap } : {})
      }
    })

    try {
      await enqueueCampaignBatch({ campaignId, dbName, sendRunId, page: 0 })
    } catch (e: unknown) {
      await (Campaign as CampaignModel).updateOne(campaignScope, {
        $set: { status: campaign.status }
      })
      logSendError('enqueueFailed.retry', { campaignId, dbName, error: String(e) })
      throw createError({ statusCode: 503, message: 'Failed to queue campaign emails. Try again.' })
    }

    const pending = retryable
    const total = sentCount + failedCount + pending
    logSend('queued.retry', { campaignId, dbName, sendRunId, retryable, sentCount })
    return {
      ok: true,
      total,
      valid: pending,
      invalid: 0,
      queued: pending,
      sent: sentCount,
      failed: failedCount,
      pending,
      sendRunId,
      resumed: true
    }
  }

  const inFlight = await (CampaignRecipient as CampaignRecipientModel).countDocuments({
    campaign: campaignId,
    status: {
      $in: [
        CAMPAIGN_RECIPIENT_STATUS_PENDING,
        CAMPAIGN_RECIPIENT_STATUS_SENDING
      ]
    }
  })
  if (inFlight > 0 || campaign.status === 'Sending') {
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
      pending: 0,
      sendRunId
    }
  }

  const snap = options?.mergeUserSnapshot
  await (Campaign as CampaignModel).updateOne(campaignScope, {
    $set: {
      status: 'Sending',
      sendRunId,
      sendPage: 0,
      ...(snap ? { mergeUserSnapshot: snap } : {})
    }
  })

  try {
    await enqueueCampaignBatch({ campaignId, dbName, sendRunId, page: 0 })
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
    sendRunId,
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
    pending: valid.length,
    sendRunId
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
      status: { $in: [CAMPAIGN_RECIPIENT_STATUS_PENDING, CAMPAIGN_RECIPIENT_STATUS_SENDING] }
    }),
    (CampaignRecipient as CampaignRecipientModel).countDocuments({
      campaign: campaignId,
      status: CAMPAIGN_RECIPIENT_STATUS_SENT
    }),
    (CampaignRecipient as CampaignRecipientModel).countDocuments({
      campaign: campaignId,
      status: CAMPAIGN_RECIPIENT_STATUS_FAILED
    })
  ])

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

export interface ProcessBatchOptions {
  sendRunId: string
  page: number
}

/**
 * Processes up to CAMPAIGN_SEND_BATCH_SIZE pending/failed recipients (BullMQ worker).
 * Uses Brevo messageVersions + idempotency key per batch (mortdash-crm ratesheet pattern).
 */
export async function processBatch(
  models: TenantClientModels,
  campaignId: string,
  options: ProcessBatchOptions
): Promise<ProcessBatchResult> {
  const { Campaign, CampaignRecipient, EmailTemplate, EmailDynamicVariable } = models
  const campaign = await (Campaign as CampaignModel)
    .findById(campaignId)
    .lean<CampaignLean | null>()
  if (!campaign) {
    throw createError({ statusCode: 404, message: 'Campaign not found' })
  }

  if (campaignSendJobShouldSkip(campaign, options.sendRunId)) {
    logSend('batch.skipped', {
      campaignId,
      sendRunId: options.sendRunId,
      campaignSendRunId: campaign.sendRunId,
      status: campaign.status
    })
    const counts = await countRecipientStatuses(
      CampaignRecipient as CampaignRecipientModel,
      campaignId
    )
    return {
      campaignId,
      campaignStatus: campaign.status,
      pending: counts.pending,
      sent: counts.sent,
      failed: counts.failed,
      total: counts.pending + counts.sent + counts.failed,
      done: counts.pending === 0,
      skipped: true
    }
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

  const pending = await claimCampaignRecipientBatch(
    CampaignRecipient as CampaignRecipientModel,
    campaignId,
    CAMPAIGN_SEND_BATCH_SIZE
  )

  if (pending.length === 0) {
    const [sendingOnlyCount, finalized] = await Promise.all([
      (CampaignRecipient as CampaignRecipientModel).countDocuments({
        campaign: campaignId,
        status: CAMPAIGN_RECIPIENT_STATUS_SENDING
      }),
      finalizeCampaignSendIfComplete(models, campaignId)
    ])
    const counts = await countRecipientStatuses(
      CampaignRecipient as CampaignRecipientModel,
      campaignId
    )
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
        sent: counts.sent,
        failed: counts.failed
      })
    }
    let waitForInFlight = sendingOnlyCount > 0 && counts.pending > 0
    if (waitForInFlight) {
      const acked = await ackStaleInFlightSendingRecipients(models, campaignId)
      if (acked > 0) {
        const afterAck = await countRecipientStatuses(
          CampaignRecipient as CampaignRecipientModel,
          campaignId
        )
        counts.pending = afterAck.pending
        counts.sent = afterAck.sent
        counts.failed = afterAck.failed
        waitForInFlight = afterAck.pending > 0
        if (!waitForInFlight) {
          await finalizeCampaignSendIfComplete(models, campaignId)
          const refreshed = await (Campaign as CampaignModel)
            .findById(campaignId)
            .lean<CampaignLean | null>()
          if (refreshed) campaignUpdated.status = refreshed.status
        }
      }
      if (waitForInFlight) {
        logSend('batchIdle.waitingSending', {
          campaignId,
          sendRunId: options.sendRunId,
          page: options.page,
          sendingOnlyCount
        })
      }
    }
    const stillQueued = counts.pending > 0
    return {
      campaignId,
      campaignStatus: campaignUpdated.status,
      pending: counts.pending,
      sent: counts.sent,
      failed: counts.failed,
      total: counts.pending + counts.sent + counts.failed,
      done: counts.pending === 0,
      chainNext: stillQueued && !waitForInFlight,
      processedInBatch: 0
    }
  }

  await clearStaleSendingRecipients(
    models,
    campaignId,
    pending.map((r) => String(r._id))
  )

  let processedInBatch = 0

  logSend('batchStart', {
    campaignId,
    sendRunId: options.sendRunId,
    page: options.page,
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

  if (!templateHtml || !campaign.sender?.email) {
    logSendWarn('missingTemplateOrSender', {
      campaignId,
      hasTemplate: !!templateHtml,
      sender: campaign.sender?.email
    })
    await (CampaignRecipient as CampaignRecipientModel).updateMany(
      { _id: { $in: pending.map((r) => r._id) } },
      { $set: { status: CAMPAIGN_RECIPIENT_STATUS_FAILED, error: 'Missing email template or sender' } }
    )
    processedInBatch = pending.length
  } else {
    const tenantDbNameForTags = (Campaign as CampaignModel).db?.db?.databaseName
    let brevoTenantTagValue: string | undefined
    let unsubscribeSigningSecret: string | undefined
    if (tenantDbNameForTags) {
      brevoTenantTagValue = tenantDbNameForTags
      try {
        const registry = await getRegistryConnection()
        const row = await findRegistryTenantByDbName(registry, tenantDbNameForTags)
        const tid = row?.tenantId?.trim()
        if (tid) brevoTenantTagValue = tid
        if (row?.clientKeyHash) unsubscribeSigningSecret = row.clientKeyHash
      } catch (err) {
        console.warn('[SendCampaign] registry lookup for Brevo tenant tag failed', {
          dbName: tenantDbNameForTags,
          err
        })
      }
    }

    const snap = campaign.mergeUserSnapshot
    const userForTag =
      snap?.email?.trim() ||
      [snap?.firstName, snap?.lastName].filter(Boolean).join(' ').trim() ||
      undefined

    const replyTo = buildCampaignReplyTo({ campaign })

    type Prepared = {
      row: CampaignRecipientLean
      version: CampaignBatchMessageVersion
      failed?: string
    }

    const prepared: Prepared[] = pending.map((r) => {
      const emailKey = normalizeMarketingEmail(r.email)
      const contact = emailKey ? contactByEmail.get(emailKey) : undefined
      if (contact?.isUnsubscribe === true) {
        return { row: r, version: { to: [{ email: r.email }], subject: '', htmlContent: '' }, failed: 'Contact unsubscribed' }
      }
      const mergeRoot = composeEmailMergeRoot(
        campaign.mergeUserSnapshot,
        contact ?? null,
        dynamicVariableBindings
      )
      applyDefaultUnsubscribeMergeValue(mergeRoot, {
        dbName: tenantDbNameForTags,
        contactId: contact?._id ? String(contact._id) : undefined,
        clientKeyHash: unsubscribeSigningSecret
      })
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
      const subjectRendered = mergeMustacheTemplate(campaign.subject || '(No subject)', mergeRoot)
      const htmlRendered = mergeMustacheTemplate(templateHtml, mergeRoot)
      const name =
        [contact?.firstName, contact?.lastName].filter(Boolean).join(' ').trim() || undefined
      const params = recipientBrevoParams(contact)
      return {
        row: r,
        version: {
          to: [{ email: r.email, ...(name ? { name } : {}) }],
          subject: subjectRendered,
          htmlContent: htmlRendered,
          ...(params ? { params } : {})
        }
      }
    })

    processedInBatch = pending.length

    const toSend = prepared.filter((p) => !p.failed)
    const idempotencyKey = campaignBatchBrevoIdempotencyKey({
      campaignId,
      sendRunId: options.sendRunId,
      page: options.page,
      recipientRowIds: toSend.map((p) => String(p.row._id))
    })

    const batchResult = await sendCampaignBatchWithMessageVersions({
      sender: campaign.sender,
      ...(replyTo ? { replyTo } : {}),
      messageVersions: toSend.map((p) => p.version),
      tags: [`campaign:${campaignId}`],
      idempotencyKey,
      ...(tenantDbNameForTags && brevoTenantTagValue
        ? { tenantId: brevoTenantTagValue, dbName: tenantDbNameForTags }
        : {}),
      ...(userForTag ? { user: userForTag } : {})
    })

    const ops: Parameters<CampaignRecipientModel['bulkWrite']>[0] = []

    for (const p of prepared) {
      if (p.failed) {
        ops.push({
          updateOne: {
            filter: { _id: p.row._id },
            update: { $set: { status: CAMPAIGN_RECIPIENT_STATUS_FAILED, error: p.failed } }
          }
        })
      }
    }

    if (batchResult.error) {
      for (const p of toSend) {
        ops.push({
          updateOne: {
            filter: { _id: p.row._id },
            update: { $set: { status: CAMPAIGN_RECIPIENT_STATUS_FAILED, error: batchResult.error } }
          }
        })
      }
    } else {
      for (let i = 0; i < toSend.length; i++) {
        const p = toSend[i]
        if (!p) continue
        const raw = batchResult.messageIds[i]
        const trimmed = raw && String(raw).trim() ? String(raw).trim() : ''
        if (trimmed) {
          ops.push({
            updateOne: {
              filter: { _id: p.row._id },
              update: {
                $set: {
                  status: CAMPAIGN_RECIPIENT_STATUS_SENT,
                  sentAt: new Date(),
                  brevoMessageId: trimmed
                }
              }
            }
          })
        } else {
          ops.push({
            updateOne: {
              filter: { _id: p.row._id },
              update: {
                $set: {
                  status: CAMPAIGN_RECIPIENT_STATUS_FAILED,
                  error: MISSING_BREVO_ID_MESSAGE
                }
              }
            }
          })
        }
      }
    }

    if (ops.length) {
      await (CampaignRecipient as CampaignRecipientModel).bulkWrite(ops, { ordered: false })
    }

    await (Campaign as CampaignModel).updateOne(
      { _id: campaignId },
      { $set: { sendPage: options.page } }
    )
  }

  const counts = await countRecipientStatuses(
    CampaignRecipient as CampaignRecipientModel,
    campaignId
  )

  if (counts.pending === 0) {
    await finalizeCampaignSendIfComplete(models, campaignId)
  }

  const campaignUpdated = await (Campaign as CampaignModel)
    .findById(campaignId)
    .lean<CampaignLean | null>()
  if (!campaignUpdated) {
    throw createError({ statusCode: 404, message: 'Campaign not found' })
  }

  const hasNext = counts.pending > 0

  logSend('batchDone', {
    campaignId,
    sendRunId: options.sendRunId,
    page: options.page,
    pending: counts.pending,
    sent: counts.sent,
    failed: counts.failed,
    campaignStatus: campaignUpdated.status,
    hasNext
  })

  return {
    campaignId,
    campaignStatus: campaignUpdated.status,
    pending: counts.pending,
    sent: counts.sent,
    failed: counts.failed,
    total: counts.pending + counts.sent + counts.failed,
    done: !hasNext,
    chainNext: hasNext,
    processedInBatch
  }
}

async function countRecipientStatuses(
  CampaignRecipient: CampaignRecipientModel,
  campaignId: string
): Promise<{ pending: number; sent: number; failed: number }> {
  const [pending, sent, failed] = await Promise.all([
    CampaignRecipient.countDocuments({
      campaign: campaignId,
      status: { $in: [CAMPAIGN_RECIPIENT_STATUS_PENDING, CAMPAIGN_RECIPIENT_STATUS_SENDING] }
    }),
    CampaignRecipient.countDocuments({
      campaign: campaignId,
      status: CAMPAIGN_RECIPIENT_STATUS_SENT
    }),
    CampaignRecipient.countDocuments({
      campaign: campaignId,
      status: CAMPAIGN_RECIPIENT_STATUS_FAILED
    })
  ])
  return { pending, sent, failed }
}
