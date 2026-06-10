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
import { enqueueCampaignBatchFanOut, enqueueCampaignSendPrepare } from '../queue/emailQueue'
import {
  removeCampaignBatchCloudTasks,
  hasCampaignBatchCloudTasks,
  hasCampaignPrepareCloudTask
} from '../queue/campaignCloudTasksQueue'
import { isCampaignCloudTasksEnabled } from '../config/campaignCloudTasks'
import {
  contactsByEmailForAudience,
  contactsByEmailForBatch,
  recipientEmailsForCampaign
} from '../utils/emailMerge/campaignAudience'
import { applyDefaultUnsubscribeMergeValue, composeEmailMergeRoot } from '../utils/emailMerge/composeMergeRoot'
import { registerCampaignBrevoMessageRouting } from './campaignBrevoMessageRouting.service'
import { logCampaignSendBatchVisibility } from './campaignSendVisibilityLog.service'
import { resolveCampaignAudienceSummary } from '../utils/campaign/resolveCampaignAudienceCounts'
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
import { countRecipientStatuses, countOutstandingSendWork, outstandingSendWorkFromStatusCounts } from '../utils/campaignSend/countRecipientStatuses'
import { countCampaignRecipientStatuses } from '../utils/campaignSend/recipientStatusCounts'
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
  /** Recipients claimed by a worker and awaiting Brevo / DB ack. */
  sending?: number
  failed: number
  total: number
  done: boolean
  /** Recipient rows are still being built (async prepare). */
  preparing?: boolean
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
  /** Recipient rows are being built in a background prepare task. */
  preparing?: boolean
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
  campaignId: string,
  sendRunId?: string
): Promise<boolean> {
  const { Campaign, CampaignRecipient } = models
  const sendingCount = await (CampaignRecipient as CampaignRecipientModel).countDocuments({
    campaign: campaignId,
    status: CAMPAIGN_RECIPIENT_STATUS_SENDING
  })
  if (sendingCount > 0) return true

  if (!isCampaignCloudTasksEnabled()) return false
  const dbName = tenantDbNameFromModels(models)
  if (!dbName) return false

  let runId = String(sendRunId || '').trim()
  if (!runId) {
    const campaign = await (Campaign as CampaignModel)
      .findById(campaignId)
      .select('sendRunId')
      .lean<Pick<CampaignLean, 'sendRunId'> | null>()
    runId = String(campaign?.sendRunId || '').trim()
  }
  if (await hasCampaignBatchCloudTasks(campaignId, dbName, runId || undefined)) return true
  return hasCampaignPrepareCloudTask(campaignId, dbName, runId || undefined)
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
    const audience = await resolveCampaignAudienceSummary(conn, campaign)
    const hasListAudience =
      campaign.recipientsType === 'list' && String(campaign.recipientsListId ?? '').trim()
    if (!hasListAudience && audience.recipientCount === 0) {
      throw createError({ statusCode: 400, message: 'No recipients to send to' })
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
      await enqueueCampaignSendPrepare({
        campaignId,
        dbName,
        sendRunId,
        mode,
        revertStatus: revertStatus
      })
    } catch (e: unknown) {
      await (Campaign as CampaignModel).updateOne(campaignScope, {
        $set: { status: campaign.status }
      })
      logSendError('prepareEnqueueFailed', {
        campaignId,
        dbName,
        mode,
        error: e instanceof Error ? e.message : String(e)
      })
      throw createError({ statusCode: 503, message: 'Failed to queue campaign emails. Try again.' })
    }

    const estimate = Math.max(audience.recipientCount, hasListAudience ? 1 : 0)

    logSend(mode === 'resend_all' ? 'queued.resendAll.async' : 'queued.async', {
      campaignId,
      dbName,
      sendRunId,
      estimate,
      mode
    })

    return {
      ok: true,
      total: estimate,
      valid: estimate,
      invalid: 0,
      queued: estimate,
      sent: 0,
      failed: 0,
      pending: estimate,
      sendRunId,
      preparing: true,
      ...(mode === 'resend_all' ? { resentAll: true as const } : {})
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

  const statusCounts = await countCampaignRecipientStatuses(
    CampaignRecipient as CampaignRecipientModel,
    campaignId
  )
  const outstanding =
    campaign.status === 'Sending'
      ? await countOutstandingSendWork(CampaignRecipient as CampaignRecipientModel, campaignId)
      : statusCounts.pending + statusCounts.sending + statusCounts.failed
  let progressPending =
    campaign.status === 'Sending'
      ? statusCounts.pending + statusCounts.failed
      : statusCounts.pending
  let progressTotal = statusCounts.total
  let preparing = false

  if (campaign.status === 'Sending' && progressTotal === 0) {
    const conn = (Campaign as CampaignModel).db as Connection | undefined
    if (conn) {
      const audience = await resolveCampaignAudienceSummary(conn, {
        _id: campaign._id,
        recipientsType: campaign.recipientsType,
        recipientsListId: campaign.recipientsListId
      })
      const hasListAudience =
        campaign.recipientsType === 'list' && !!String(campaign.recipientsListId ?? '').trim()
      const estimate = Math.max(audience.recipientCount, hasListAudience ? 1 : 0)
      if (estimate > 0) {
        preparing = true
        progressTotal = estimate
        progressPending = estimate
      }
    }
  }

  let campaignStatus = campaign.status
  if (!preparing && outstanding === 0 && campaignStatus === 'Sending') {
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
    sent: statusCounts.sent,
    sending: statusCounts.sending,
    failed: statusCounts.failed,
    total: progressTotal,
    preparing,
    done: preparing ? false : outstanding === 0 && campaignStatus !== 'Sending'
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
    const statusCounts = await countCampaignRecipientStatuses(
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
      pending: statusCounts.pending + statusCounts.failed,
      sent: statusCounts.sent,
      sending: statusCounts.sending,
      failed: statusCounts.failed,
      total: statusCounts.total,
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

    const statusCounts = await countCampaignRecipientStatuses(
      CampaignRecipient as CampaignRecipientModel,
      campaignId
    )
    let outstanding = outstandingSendWorkFromStatusCounts(statusCounts)
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
        sent: statusCounts.sent,
        failed: statusCounts.failed
      })
    }
    let waitForInFlight = sendingOnlyCount > 0 && outstanding > 0
    if (waitForInFlight) {
      const acked = await ackStaleInFlightSendingRecipients(models, campaignId)
      if (acked > 0) {
        const afterAck = await countCampaignRecipientStatuses(
          CampaignRecipient as CampaignRecipientModel,
          campaignId
        )
        statusCounts.pending = afterAck.pending
        statusCounts.sent = afterAck.sent
        statusCounts.failed = afterAck.failed
        statusCounts.sending = afterAck.sending
        const afterOutstanding = outstandingSendWorkFromStatusCounts(afterAck)
        outstanding = afterOutstanding
        waitForInFlight = afterOutstanding > 0 && afterAck.sending > 0
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
      pending: statusCounts.pending + statusCounts.failed,
      sent: statusCounts.sent,
      sending: statusCounts.sending,
      failed: statusCounts.failed,
      total: statusCounts.total,
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

  const personalized = sendContext.requiresPerRecipientMerge
  const batchEmails = pending.map((r) => r.email)
  const contactByEmail = personalized
    ? await contactsByEmailForAudience(models, campaign, batchEmails)
    : await contactsByEmailForBatch(models, batchEmails)
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

    let prepared: Prepared[]

    if (personalized) {
      prepared = pending.map((r) => {
        const emailKey = normalizeMarketingEmail(r.email)
        const contact = emailKey ? contactByEmail.get(emailKey) : undefined
        if (contact?.isUnsubscribe === true) {
          return {
            row: r,
            version: { to: [{ email: r.email }], subject: '', htmlContent: '' },
            failed: 'Contact unsubscribed'
          }
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
    } else {
      const baseMergeRoot = composeEmailMergeRoot(
        mergeUserSnapshotForContact(null, campaign.mergeUserSnapshot),
        null,
        dynamicVariableBindings
      )
      applyDefaultUnsubscribeMergeValue(baseMergeRoot, {
        dbName: tenantDbNameForTags,
        clientKeyHash: unsubscribeSigningSecret,
        crmAppUrl: unsubscribeCrmAppUrl
      })
      const subjectRendered = mergeMustacheTemplate(campaign.subject || '(No subject)', baseMergeRoot)
      const htmlRendered = mergeMustacheTemplate(templateHtml, baseMergeRoot)
      prepared = pending.map((r) => {
        const emailKey = normalizeMarketingEmail(r.email)
        const contact = emailKey ? contactByEmail.get(emailKey) : undefined
        if (contact?.isUnsubscribe === true) {
          return {
            row: r,
            version: { to: [{ email: r.email }], subject: '', htmlContent: '' },
            failed: 'Contact unsubscribed'
          }
        }
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
    }

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
                  },
                  $unset: { error: 1 }
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
      void getRegistryConnection()
        .then((registry) => registerCampaignBrevoMessageRouting(registry, routingRows))
        .catch((err) => {
          logSendWarn('brevoRouting.registerFailed', {
            campaignId,
            count: routingRows.length,
            error: err instanceof Error ? err.message : String(err)
          })
        })
    }

    await (Campaign as CampaignModel).updateOne(
      { _id: campaignId },
      { $set: { sendPage: options.page } }
    )
  }

  const statusCounts = await countCampaignRecipientStatuses(
    CampaignRecipient as CampaignRecipientModel,
    campaignId
  )
  const outstanding = outstandingSendWorkFromStatusCounts(statusCounts)

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
    pending: statusCounts.pending,
    sending: statusCounts.sending,
    outstanding,
    sent: statusCounts.sent,
    failed: statusCounts.failed,
    campaignStatus: campaignUpdated.status,
    hasNext
  })

  if (String(process.env.CAMPAIGN_SEND_VISIBILITY_LOG || '').toLowerCase() === 'true') {
    void logCampaignSendBatchVisibility(
      CampaignRecipient as CampaignRecipientModel,
      campaignId,
      logSend,
      {
        sendRunId: options.sendRunId,
        page: options.page,
        batchEmails: processedInBatch > 0 ? pending.map((r) => r.email) : undefined
      }
    )
  }

  return {
    campaignId,
    campaignStatus: campaignUpdated.status,
    pending: statusCounts.pending + statusCounts.failed,
    sent: statusCounts.sent,
    sending: statusCounts.sending,
    failed: statusCounts.failed,
    total: statusCounts.total,
    outstanding,
    done: !hasNext,
    chainNext: hasNext,
    processedInBatch
  }
}
