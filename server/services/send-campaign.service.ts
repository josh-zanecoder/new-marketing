import { randomUUID } from 'node:crypto'
import type { Connection } from 'mongoose'
import { getRegistryConnection } from '../lib/mongoose'
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
import { isValidMarketingEmail, normalizeMarketingEmail } from '../helpers/marketingEmail'
import { enqueueCampaignBatchFanOut } from '../queue/emailQueue'
import { removeCampaignBatchCloudTasks, hasCampaignBatchCloudTasks } from '../queue/campaignCloudTasksQueue'
import { isCampaignCloudTasksEnabled } from '../config/campaignCloudTasks'
import {
  contactsByEmailForAudience,
  recipientEmailsForCampaign
} from '../utils/emailMerge/campaignAudience'
import { applyDefaultUnsubscribeMergeValue, composeEmailMergeRoot } from '../utils/emailMerge/composeMergeRoot'
import { registerCampaignBrevoMessageRouting } from './campaignBrevoMessageRouting.service'
import { logCampaignSendBatchVisibility } from './campaignSendVisibilityLog.service'
import { mergeTenantOwnerEmailScopeFilter } from '../utils/contactOwnerFilter'
import {
  buildCampaignCreatorReplyTo,
  buildReplyToFromContactOwner
} from '@server/utils/email/replyToFromContactMetadata'
import { mergeUserSnapshotForContact } from '@server/utils/emailMerge/tenantUserFromAuth'
import { sendCampaignBatchWithMessageVersions } from './brevo.service'
import { mergeMustacheTemplate } from '~~/shared/utils/emailTemplateMerge'
import { campaignBatchBrevoIdempotencyKey } from '../utils/campaignSend/campaignBatchBrevoIdempotencyKey'
import { claimCampaignRecipientBatch } from '../utils/campaignSend/claimCampaignRecipientBatch'
import { countRecipientStatuses, countOutstandingSendWork } from '../utils/campaignSend/countRecipientStatuses'
import {
  CAMPAIGN_RECIPIENT_STATUS_CANCELLED,
  CAMPAIGN_RECIPIENT_STATUS_FAILED,
  CAMPAIGN_RECIPIENT_STATUS_PENDING,
  CAMPAIGN_RECIPIENT_STATUS_SENDING,
  CAMPAIGN_RECIPIENT_STATUS_SENT,
  CAMPAIGN_SEND_RECONCILE_ACK_SENDING_MS_DEFAULT,
  CAMPAIGN_SEND_STALE_SENDING_MS_DEFAULT
} from '../utils/campaignSend/constants'
import {
  resolveCampaignSendRecipientDelayMs,
  sleepCampaignSendRecipientDelayIfConfigured
} from '../utils/campaignSend/batchTiming'
import { resolveCampaignSendBatchSizeForContent } from '../utils/campaignSend/campaignBatchSize'
import {
  clearCampaignSendRunCache,
  getCampaignSendRunContext
} from '../utils/campaignSend/campaignSendRunCache'
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
    .select('status sendRunId')
    .lean<Pick<CampaignLean, 'status' | 'sendRunId'> | null>()
  if (!campaign || campaign.status !== 'Sending') {
    return { finalized: false }
  }

  const counts = await countRecipientStatuses(
    CampaignRecipient as CampaignRecipientModel,
    campaignId
  )
  const { pending: pendingCount, sent: sentCount, failed: failedCount } = counts
  const outstanding = await countOutstandingSendWork(
    CampaignRecipient as CampaignRecipientModel,
    campaignId
  )

  if (outstanding > 0) {
    return { finalized: false, pending: pendingCount, sent: sentCount, failed: failedCount }
  }

  if (pendingCount > 0) {
    return { finalized: false, pending: pendingCount, sent: sentCount, failed: failedCount }
  }

<<<<<<< Updated upstream
  const total = sentCount + failedCount
  if (total === 0 && (await campaignSendPipelineStillActive(models, campaignId))) {
    logSend('finalize.deferred.pipelineActive', { campaignId, sent: sentCount, failed: failedCount })
    return { finalized: false, pending: pendingCount, sent: sentCount, failed: failedCount }
  }

  const newStatus = total === 0 || failedCount === total ? 'Failed' : 'Sent'
  const updated = await (Campaign as CampaignModel).findOneAndUpdate(
    { _id: campaignId, status: 'Sending' },
    { $set: { status: newStatus }, $unset: { scheduledAt: 1 } },
    { new: true }
  )
  if (!updated) {
    return { finalized: false, pending: pendingCount, sent: sentCount, failed: failedCount }
  }
=======
>>>>>>> Stashed changes
  const runId = String(campaign.sendRunId || '').trim()
  const total = sentCount + failedCount
  if (total === 0 && (await campaignSendPipelineStillActive(models, campaignId, runId))) {
    logSend('finalize.deferred.pipelineActive', { campaignId, sent: sentCount, failed: failedCount })
    return { finalized: false, pending: pendingCount, sent: sentCount, failed: failedCount }
  }

  const newStatus = total === 0 || failedCount === total ? 'Failed' : 'Sent'
  const updated = await (Campaign as CampaignModel).findOneAndUpdate(
    { _id: campaignId, status: 'Sending' },
    { $set: { status: newStatus }, $unset: { scheduledAt: 1 } },
    { new: true }
  )
  if (!updated) {
    return { finalized: false, pending: pendingCount, sent: sentCount, failed: failedCount }
  }
  if (runId) clearCampaignSendRunCache(runId, campaignId)
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
  /** Recipients still to process in the active send (pending + sending + retryable failed). */
  outstanding?: number
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
   * `retry_failed` — keep delivery ledger; only resend non-`sent` rows (failed/pending/cancelled).
   * `resend_all` — rebuild recipient rows from audience and send to everyone again.
   */
  mode?: 'new' | 'retry_failed' | 'resend_all'
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

/** When a scheduled send is unscheduled, return the correct pre-schedule status. */
export async function resolveCampaignStatusAfterScheduleCancel(
  CampaignRecipient: CampaignRecipientModel,
  campaignId: string,
  scheduledSendMode?: 'new' | 'resume' | 'resend_all'
): Promise<'Draft' | 'Paused' | 'Cancelled'> {
  if (scheduledSendMode === 'resend_all') return 'Cancelled'
  const hasPriorSendAttempt = await CampaignRecipient.countDocuments({
    campaign: campaignId,
    status: { $in: [CAMPAIGN_RECIPIENT_STATUS_SENT, CAMPAIGN_RECIPIENT_STATUS_CANCELLED] }
  })
  if (hasPriorSendAttempt === 0) return 'Draft'
  if (scheduledSendMode === 'resume') return 'Paused'
  const sent = await CampaignRecipient.countDocuments({
    campaign: campaignId,
    status: CAMPAIGN_RECIPIENT_STATUS_SENT
  })
  return sent > 0 ? 'Paused' : 'Cancelled'
}

/** Scheduled sends from a draft start fresh; cancelled/failed sends resume the delivery ledger. */
export async function resolveCampaignSendMode(
  CampaignRecipient: CampaignRecipientModel,
  campaignId: string
): Promise<'new' | 'retry_failed'> {
  const hasDeliveryLedger = await CampaignRecipient.countDocuments({ campaign: campaignId })
  return hasDeliveryLedger > 0 ? 'retry_failed' : 'new'
}

export async function countUnsentRecipientsForResume(
  CampaignRecipient: CampaignRecipientModel,
  campaignId: string
): Promise<number> {
  return CampaignRecipient.countDocuments({
    campaign: campaignId,
    status: {
      $in: [
        CAMPAIGN_RECIPIENT_STATUS_PENDING,
        CAMPAIGN_RECIPIENT_STATUS_FAILED,
        CAMPAIGN_RECIPIENT_STATUS_CANCELLED
      ]
    }
  })
}

/** Maps persisted schedule intent to beginCampaignSend mode when the job fires. */
export async function resolveScheduledCampaignBeginMode(
  campaign: Pick<CampaignLean, 'scheduledSendMode'>,
  CampaignRecipient: CampaignRecipientModel,
  campaignId: string
): Promise<'new' | 'retry_failed' | 'resend_all'> {
  if (campaign.scheduledSendMode === 'resend_all') return 'resend_all'
  if (campaign.scheduledSendMode === 'resume') return 'retry_failed'
  if (campaign.scheduledSendMode === 'new') return 'new'
  return resolveCampaignSendMode(CampaignRecipient, campaignId)
}

async function prepareCancelledRecipientsForRetry(
  CampaignRecipient: CampaignRecipientModel,
  campaignId: string
): Promise<void> {
  await CampaignRecipient.updateMany(
    {
      campaign: campaignId,
      status: CAMPAIGN_RECIPIENT_STATUS_CANCELLED
    },
    {
      $set: { status: CAMPAIGN_RECIPIENT_STATUS_PENDING },
      $unset: { error: 1, brevoMessageId: 1 }
    }
  )
}

/** Reset rows stuck in `sending` from a prior interrupted run so retry can claim them. */
async function resetInterruptedSendingForRetry(
  CampaignRecipient: CampaignRecipientModel,
  campaignId: string
): Promise<number> {
  const res = await CampaignRecipient.updateMany(
    {
      campaign: campaignId,
      status: CAMPAIGN_RECIPIENT_STATUS_SENDING
    },
    {
      $set: {
        status: CAMPAIGN_RECIPIENT_STATUS_FAILED,
        error: 'Interrupted send; queued for retry.'
      },
      $unset: { brevoMessageId: 1 }
    }
  )
  const n = res.modifiedCount ?? 0
  if (n > 0) {
    logSend('retry.resetSending', { campaignId, count: n })
  }
  return n
}

function tenantDbNameFromModels(models: TenantClientModels): string {
  const { Campaign } = models
  return String((Campaign as CampaignModel).db?.db?.databaseName ?? '').trim()
}

async function campaignSendPipelineStillActive(
  models: TenantClientModels,
<<<<<<< Updated upstream
  campaignId: string
): Promise<boolean> {
  const { CampaignRecipient } = models
=======
  campaignId: string,
  sendRunId?: string
): Promise<boolean> {
  const { Campaign, CampaignRecipient } = models
>>>>>>> Stashed changes
  const sendingCount = await (CampaignRecipient as CampaignRecipientModel).countDocuments({
    campaign: campaignId,
    status: CAMPAIGN_RECIPIENT_STATUS_SENDING
  })
  if (sendingCount > 0) return true

  if (!isCampaignCloudTasksEnabled()) return false
  const dbName = tenantDbNameFromModels(models)
  if (!dbName) return false
<<<<<<< Updated upstream
  return hasCampaignBatchCloudTasks(campaignId, dbName)
=======

  let runId = String(sendRunId || '').trim()
  if (!runId) {
    const campaign = await (Campaign as CampaignModel)
      .findById(campaignId)
      .select('sendRunId')
      .lean<Pick<CampaignLean, 'sendRunId'> | null>()
    runId = String(campaign?.sendRunId || '').trim()
  }
  return hasCampaignBatchCloudTasks(campaignId, dbName, runId || undefined)
>>>>>>> Stashed changes
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
    await prepareCancelledRecipientsForRetry(
      CampaignRecipient as CampaignRecipientModel,
      campaignId
    )
    await resetInterruptedSendingForRetry(
      CampaignRecipient as CampaignRecipientModel,
      campaignId
    )
    await removeCampaignBatchCloudTasks(campaignId, dbName)

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
        message: 'No unsent recipients to resume'
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
      await enqueueCampaignBatchFanOut({
        campaignId,
        dbName,
        sendRunId,
        startPage: 0,
        pendingEstimate: retryable
      })
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

  if (mode === 'resend_all') {
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
  }

  if (mode === 'new') {
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
  }

  if (mode === 'new' || mode === 'resend_all') {
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
    await removeCampaignBatchCloudTasks(campaignId, dbName)
    await (Campaign as CampaignModel).updateOne(campaignScope, {
      $set: {
        status: 'Sending',
        sendRunId,
        sendPage: 0,
        ...(snap ? { mergeUserSnapshot: snap } : {})
      }
    })

    try {
      await enqueueCampaignBatchFanOut({
        campaignId,
        dbName,
        sendRunId,
        startPage: 0,
        pendingEstimate: valid.length
      })
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

    logSend(mode === 'resend_all' ? 'queued.resendAll' : 'queued', {
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
      sendRunId,
      ...(mode === 'resend_all' ? { resentAll: true } : {})
    }
  }

  throw createError({ statusCode: 400, message: 'Invalid send mode' })
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

  const counts = await countRecipientStatuses(
    CampaignRecipient as CampaignRecipientModel,
    campaignId
  )
  const { pending: pendingCount, sent: sentCount, failed: failedCount } = counts
  const outstanding =
    campaign.status === 'Sending'
      ? await countOutstandingSendWork(CampaignRecipient as CampaignRecipientModel, campaignId)
      : pendingCount
  const progressPending =
    campaign.status === 'Sending' ? outstanding : pendingCount
  const progressTotal =
    campaign.status === 'Sending'
      ? sentCount + outstanding
      : pendingCount + sentCount + failedCount

  let campaignStatus = campaign.status
  if (outstanding === 0 && campaignStatus === 'Sending') {
    const fresh = await (Campaign as CampaignModel)
      .findOne(campaignScope)
      .select('status')
      .lean<Pick<CampaignLean, 'status'> | null>()
    if (fresh) campaignStatus = fresh.status
  }

  return {
    campaignId,
    campaignStatus,
    pending: progressPending,
    sent: sentCount,
    failed: failedCount,
    total: progressTotal,
    done: outstanding === 0 && campaignStatus !== 'Sending'
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
  const { Campaign, CampaignRecipient } = models
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
    const outstanding = await countOutstandingSendWork(
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
      outstanding,
      done: outstanding === 0,
      skipped: true
    }
  }

  const tenantDbNameForTags = (Campaign as CampaignModel).db?.db?.databaseName as
    | string
    | undefined
  const sendContext = await getCampaignSendRunContext(
    models,
    campaign,
    options.sendRunId,
    tenantDbNameForTags
  )
  const templateHtml = sendContext.templateHtml
  const batchSize = resolveCampaignSendBatchSizeForContent(
    campaign.subject || '',
    templateHtml,
    sendContext.dynamicVariableBindings
  )

  const pending = await claimCampaignRecipientBatch(
    CampaignRecipient as CampaignRecipientModel,
    campaignId,
    batchSize
  )

  if (pending.length === 0) {
    const sendingOnlyCount = await (CampaignRecipient as CampaignRecipientModel).countDocuments({
      campaign: campaignId,
      status: CAMPAIGN_RECIPIENT_STATUS_SENDING
    })

    let finalized = { finalized: false as boolean }
    if (sendingOnlyCount === 0) {
      finalized = await finalizeCampaignSendIfComplete(models, campaignId)
    } else {
      logSend('batchIdle.skipFinalize', {
        campaignId,
        sendRunId: options.sendRunId,
        page: options.page,
        sendingOnlyCount
      })
    }

    const counts = await countRecipientStatuses(
      CampaignRecipient as CampaignRecipientModel,
      campaignId
    )
    const outstanding = await countOutstandingSendWork(
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
    let waitForInFlight = sendingOnlyCount > 0 && outstanding > 0
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
        const afterOutstanding = await countOutstandingSendWork(
          CampaignRecipient as CampaignRecipientModel,
          campaignId
        )
        waitForInFlight = afterOutstanding > 0 && sendingOnlyCount > 0
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
          sendingOnlyCount,
          outstanding
        })
      }
    }
    const stillQueued = outstanding > 0
    return {
      campaignId,
      campaignStatus: campaignUpdated.status,
      pending: counts.pending,
      sent: counts.sent,
      failed: counts.failed,
      total: counts.pending + counts.sent + counts.failed,
      outstanding,
      done: outstanding === 0,
      chainNext: stillQueued && !waitForInFlight,
      processedInBatch: 0
    }
  }

  logSend('batchStart', {
    campaignId,
    sendRunId: options.sendRunId,
    page: options.page,
    batchSize: pending.length,
    batchLimit: batchSize,
    personalized: sendContext.requiresPerRecipientMerge,
    status: campaign.status
  })

  let processedInBatch = 0

  const contactByEmail = await contactsByEmailForAudience(
    models,
    campaign,
    pending.map((r) => r.email)
  )
  const dynamicVariableBindings = sendContext.dynamicVariableBindings

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
    const { registry } = sendContext
    const tenantDbNameForTags = registry.tenantDbName
    const brevoTenantTagValue = registry.brevoTenantTagValue
    const unsubscribeSigningSecret = registry.unsubscribeSigningSecret
    const unsubscribeCrmAppUrl = registry.unsubscribeCrmAppUrl

    const snap = campaign.mergeUserSnapshot
    const userForTag =
      snap?.email?.trim() ||
      [snap?.firstName, snap?.lastName].filter(Boolean).join(' ').trim() ||
      undefined

    const creatorReplyTo = buildCampaignCreatorReplyTo(campaign)

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
        mergeUserSnapshotForContact(contact, campaign.mergeUserSnapshot),
        contact ?? null,
        dynamicVariableBindings
      )
      applyDefaultUnsubscribeMergeValue(mergeRoot, {
        dbName: tenantDbNameForTags,
        contactId: contact?._id ? String(contact._id) : undefined,
        clientKeyHash: unsubscribeSigningSecret,
        crmAppUrl: unsubscribeCrmAppUrl
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
      const replyTo = buildReplyToFromContactOwner(contact, creatorReplyTo)
      return {
        row: r,
        version: {
          to: [{ email: r.email, ...(name ? { name } : {}) }],
          subject: subjectRendered,
          htmlContent: htmlRendered,
          ...(params ? { params } : {}),
          ...(replyTo ? { replyTo } : {})
        }
      }
    })

    processedInBatch = pending.length

    const toSend = prepared.filter((p) => !p.failed)
    const recipientDelayMs = resolveCampaignSendRecipientDelayMs()
    const sendGroups: Prepared[][] =
      recipientDelayMs > 0 ? toSend.map((p) => [p]) : toSend.length ? [toSend] : []

    const ops: Parameters<CampaignRecipientModel['bulkWrite']>[0] = []
    const routingRows: Array<{
      brevoMessageId: string
      dbName: string
      campaignId: string
      recipientId: string
      email: string
    }> = []

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

    for (let groupIndex = 0; groupIndex < sendGroups.length; groupIndex++) {
      if (recipientDelayMs > 0 && groupIndex > 0) {
        await sleepCampaignSendRecipientDelayIfConfigured((message, details) => {
          logSend(message, { campaignId, sendRunId: options.sendRunId, page: options.page, ...details })
        })
        const freshCampaign = await (Campaign as CampaignModel)
          .findById(campaignId)
          .lean<Pick<CampaignLean, 'status' | 'sendRunId'> | null>()
        if (campaignSendJobShouldSkip(freshCampaign, options.sendRunId)) {
          logSend('batch.aborted.cancelled', {
            campaignId,
            sendRunId: options.sendRunId,
            page: options.page,
            groupIndex
          })
          break
        }
      }

      const group = sendGroups[groupIndex]
      if (!group?.length) continue

      const groupOpsStart = recipientDelayMs > 0 ? ops.length : 0

      const idempotencyKey = campaignBatchBrevoIdempotencyKey({
        campaignId,
        sendRunId: options.sendRunId,
        page: options.page,
        recipientRowIds: group.map((p) => String(p.row._id))
      })

      const batchResult = await sendCampaignBatchWithMessageVersions({
        sender: campaign.sender,
        messageVersions: group.map((p) => p.version),
        tags: [`campaign:${campaignId}`],
        idempotencyKey,
        ...(tenantDbNameForTags && brevoTenantTagValue
          ? { tenantId: brevoTenantTagValue, dbName: tenantDbNameForTags }
          : {}),
        ...(userForTag ? { user: userForTag } : {})
      })

      if (batchResult.error) {
        for (const p of group) {
          ops.push({
            updateOne: {
              filter: { _id: p.row._id },
              update: { $set: { status: CAMPAIGN_RECIPIENT_STATUS_FAILED, error: batchResult.error } }
            }
          })
        }
      } else {
        for (let i = 0; i < group.length; i++) {
          const p = group[i]
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
            if (tenantDbNameForTags) {
              routingRows.push({
                brevoMessageId: trimmed,
                dbName: tenantDbNameForTags,
                campaignId,
                recipientId: String(p.row._id),
                email: p.row.email
              })
            }
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

      if (recipientDelayMs > 0 && ops.length > groupOpsStart) {
        await (CampaignRecipient as CampaignRecipientModel).bulkWrite(
          ops.slice(groupOpsStart),
          { ordered: false }
        )
        ops.splice(groupOpsStart)
      }
    }

    if (ops.length) {
      await (CampaignRecipient as CampaignRecipientModel).bulkWrite(ops, { ordered: false })
    }

    if (routingRows.length) {
      try {
        const registry = await getRegistryConnection()
        await registerCampaignBrevoMessageRouting(registry, routingRows)
      } catch (err) {
        logSendWarn('brevoRouting.registerFailed', {
          campaignId,
          count: routingRows.length,
          error: err instanceof Error ? err.message : String(err)
        })
      }
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
  const outstanding = await countOutstandingSendWork(
    CampaignRecipient as CampaignRecipientModel,
    campaignId
  )

  if (outstanding === 0) {
    await finalizeCampaignSendIfComplete(models, campaignId)
  }

  const campaignUpdated = await (Campaign as CampaignModel)
    .findById(campaignId)
    .lean<CampaignLean | null>()
  if (!campaignUpdated) {
    throw createError({ statusCode: 404, message: 'Campaign not found' })
  }

  const hasNext = outstanding > 0

  logSend('batchDone', {
    campaignId,
    sendRunId: options.sendRunId,
    page: options.page,
    pending: counts.pending,
    outstanding,
    sent: counts.sent,
    failed: counts.failed,
    campaignStatus: campaignUpdated.status,
    hasNext
  })

  await logCampaignSendBatchVisibility(
    CampaignRecipient as CampaignRecipientModel,
    campaignId,
    logSend,
    {
      sendRunId: options.sendRunId,
      page: options.page,
      batchEmails: processedInBatch > 0 ? pending.map((r) => r.email) : undefined
    }
  )

  return {
    campaignId,
    campaignStatus: campaignUpdated.status,
    pending: counts.pending,
    sent: counts.sent,
    failed: counts.failed,
    total: counts.pending + counts.sent + counts.failed,
    outstanding,
    done: !hasNext,
    chainNext: hasNext,
    processedInBatch
  }
}
