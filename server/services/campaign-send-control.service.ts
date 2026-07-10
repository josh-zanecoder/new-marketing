import { randomUUID } from 'node:crypto'
import type { Connection } from 'mongoose'
import { getTenantClientModels } from '../models/tenant/tenantClientModels'
import type { CampaignLean, CampaignModel } from '../types/tenant/campaign.model'
import type { CampaignRecipientModel } from '../types/tenant/campaignRecipient.model'
import {
  hasActiveCampaignSendJob,
  removeCampaignBatchJobs,
  removeScheduledCampaignJob
} from '../queue/emailQueue'
import { mergeTenantOwnerEmailScopeFilter } from '../utils/contactOwnerFilter'
import { normalizeMarketingEmail } from '../helpers/marketingEmail'
import {
  CAMPAIGN_RECIPIENT_ABORTED_STATUSES,
  CAMPAIGN_RECIPIENT_STATUS_ABORTED,
  CAMPAIGN_RECIPIENT_STATUS_FAILED,
  CAMPAIGN_RECIPIENT_STATUS_PENDING,
  CAMPAIGN_RECIPIENT_STATUS_SENDING,
  CAMPAIGN_RECIPIENT_STATUS_SENT
} from '../utils/campaignSend/constants'
import { beginCampaignSend, finalizeCampaignSendIfComplete } from './send-campaign.service'

const ABORT_RECIPIENTS_MAX = 500
const ACTIVE_SEND_STATUSES = ['Sending', 'Paused', 'Stopped'] as const

export type HaltCampaignSendMode = 'pause' | 'stop'

function haltTargetStatus(mode: HaltCampaignSendMode): 'Paused' | 'Stopped' {
  return mode === 'pause' ? 'Paused' : 'Stopped'
}

async function releaseInFlightSendingRecipients(
  CampaignRecipient: CampaignRecipientModel,
  campaignId: string
): Promise<number> {
  const res = await CampaignRecipient.updateMany(
    { campaign: campaignId, status: CAMPAIGN_RECIPIENT_STATUS_SENDING },
    { $set: { status: CAMPAIGN_RECIPIENT_STATUS_PENDING }, $unset: { error: 1 } }
  )
  return res.modifiedCount ?? 0
}

async function recipientProgressCounts(
  CampaignRecipient: CampaignRecipientModel,
  campaignId: string
): Promise<{ pending: number; sent: number; failed: number }> {
  const [pending, sent, failed] = await Promise.all([
    CampaignRecipient.countDocuments({
      campaign: campaignId,
      status: { $in: [CAMPAIGN_RECIPIENT_STATUS_PENDING, CAMPAIGN_RECIPIENT_STATUS_SENDING] }
    }),
    CampaignRecipient.countDocuments({ campaign: campaignId, status: CAMPAIGN_RECIPIENT_STATUS_SENT }),
    CampaignRecipient.countDocuments({ campaign: campaignId, status: CAMPAIGN_RECIPIENT_STATUS_FAILED })
  ])
  return { pending, sent, failed }
}

/**
 * Pause or stop an in-progress campaign send. Invalidates the active send run so workers
 * stop chaining; pending recipients are preserved for resume.
 */
export async function haltCampaignSend(
  conn: Connection,
  campaignId: string,
  options: { mode: HaltCampaignSendMode; auth?: unknown }
): Promise<{
  ok: true
  campaignId: string
  status: string
  pending: number
  sent: number
  failed: number
}> {
  const dbName = conn.db?.databaseName
  if (!dbName) {
    throw createError({ statusCode: 500, message: 'Tenant connection has no database name' })
  }

  const models = getTenantClientModels(conn)
  const { Campaign, CampaignRecipient } = models
  const campaignScope = mergeTenantOwnerEmailScopeFilter({ _id: campaignId }, options.auth)

  const campaign = await (Campaign as CampaignModel)
    .findOne(campaignScope)
    .select('_id status')
    .lean<Pick<CampaignLean, '_id' | 'status'> | null>()

  if (!campaign) throw createError({ statusCode: 404, message: 'Campaign not found' })
  if (campaign.status !== 'Sending') {
    throw createError({ statusCode: 400, message: 'Only sending campaigns can be paused or stopped' })
  }

  const targetStatus = haltTargetStatus(options.mode)
  const newSendRunId = randomUUID()

  await removeCampaignBatchJobs(dbName, campaignId)

  const activeJob = await hasActiveCampaignSendJob(campaignId, dbName)
  if (!activeJob) {
    await releaseInFlightSendingRecipients(CampaignRecipient as CampaignRecipientModel, campaignId)
  }

  const updateResult = await (Campaign as CampaignModel).updateOne(campaignScope, {
    $set: { status: targetStatus, sendRunId: newSendRunId }
  })
  if (updateResult.matchedCount === 0) {
    throw createError({ statusCode: 404, message: 'Campaign not found' })
  }

  const counts = await recipientProgressCounts(
    CampaignRecipient as CampaignRecipientModel,
    campaignId
  )

  console.log('[CampaignSendControl] halted', {
    campaignId,
    dbName,
    mode: options.mode,
    targetStatus,
    activeJob,
    ...counts
  })

  return {
    ok: true,
    campaignId,
    status: targetStatus,
    ...counts
  }
}

/** Pause or stop every campaign currently sending for this tenant. */
export async function haltAllActiveCampaignSends(
  conn: Connection,
  options: { mode: HaltCampaignSendMode; auth?: unknown }
): Promise<{
  ok: true
  halted: Array<{ campaignId: string; status: string; pending: number; sent: number; failed: number }>
}> {
  const models = getTenantClientModels(conn)
  const { Campaign } = models

  const sending = await (Campaign as CampaignModel)
    .find(mergeTenantOwnerEmailScopeFilter({ status: 'Sending' }, options.auth))
    .select('_id')
    .lean<Array<Pick<CampaignLean, '_id'>>>()

  const halted: Array<{
    campaignId: string
    status: string
    pending: number
    sent: number
    failed: number
  }> = []

  for (const doc of sending) {
    const campaignId = String(doc._id)
    try {
      const result = await haltCampaignSend(conn, campaignId, options)
      halted.push({
        campaignId: result.campaignId,
        status: result.status,
        pending: result.pending,
        sent: result.sent,
        failed: result.failed
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn('[CampaignSendControl] haltAll skip', { campaignId, message })
    }
  }

  return { ok: true, halted }
}

/** Cancel every scheduled send for this tenant (returns campaigns to Draft). */
export async function unscheduleAllScheduledCampaignSends(conn: Connection): Promise<{
  ok: true
  unscheduled: Array<{ campaignId: string }>
}> {
  const dbName = conn.db?.databaseName
  if (!dbName) {
    throw createError({ statusCode: 500, message: 'Tenant connection has no database name' })
  }

  const models = getTenantClientModels(conn)
  const { Campaign } = models

  const scheduled = await (Campaign as CampaignModel)
    .find({ status: 'Scheduled' })
    .select('_id')
    .lean<Array<Pick<CampaignLean, '_id'>>>()

  const unscheduled: Array<{ campaignId: string }> = []

  for (const doc of scheduled) {
    const campaignId = String(doc._id)
    try {
      const removeResult = await removeScheduledCampaignJob(dbName, campaignId)
      if (!removeResult.removed && removeResult.reason === 'active') {
        console.warn('[CampaignSendControl] unscheduleAll skip active', { campaignId })
        continue
      }
      await (Campaign as CampaignModel).updateOne(
        { _id: campaignId },
        { $set: { status: 'Draft' }, $unset: { scheduledAt: 1 } }
      )
      unscheduled.push({ campaignId })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn('[CampaignSendControl] unscheduleAll skip', { campaignId, message })
    }
  }

  return { ok: true, unscheduled }
}

/** Resume a paused or stopped send from the last unsent recipient. */
export async function resumeCampaignSend(
  conn: Connection,
  campaignId: string,
  options?: { auth?: unknown; mergeUserSnapshot?: CampaignLean['mergeUserSnapshot'] }
) {
  const dbName = conn.db?.databaseName
  if (!dbName) {
    throw createError({ statusCode: 500, message: 'Tenant connection has no database name' })
  }

  const models = getTenantClientModels(conn)
  const { Campaign, CampaignRecipient } = models
  const campaignScope = mergeTenantOwnerEmailScopeFilter({ _id: campaignId }, options?.auth)

  const campaign = await (Campaign as CampaignModel)
    .findOne(campaignScope)
    .select('status')
    .lean<Pick<CampaignLean, 'status'> | null>()
  if (!campaign) throw createError({ statusCode: 404, message: 'Campaign not found' })
  if (campaign.status !== 'Paused' && campaign.status !== 'Stopped') {
    throw createError({
      statusCode: 400,
      message: 'Only paused or stopped campaigns can be resumed'
    })
  }

  const activeJob = await hasActiveCampaignSendJob(campaignId, dbName)
  if (!activeJob) {
    await releaseInFlightSendingRecipients(CampaignRecipient as CampaignRecipientModel, campaignId)
  }

  return beginCampaignSend(conn, campaignId, {
    allowedStatuses: ['Paused', 'Stopped'],
    mode: 'retry_failed',
    auth: options?.auth,
    statusOnEnqueueFailure: campaign.status,
    ...(options?.mergeUserSnapshot ? { mergeUserSnapshot: options.mergeUserSnapshot } : {})
  })
}

/**
 * Restart a paused or stopped send: reset previously sent/failed rows to pending
 * and send to the full audience again (including recipients who already received it).
 */
export async function restartCampaignSend(
  conn: Connection,
  campaignId: string,
  options?: { auth?: unknown; mergeUserSnapshot?: CampaignLean['mergeUserSnapshot'] }
) {
  const dbName = conn.db?.databaseName
  if (!dbName) {
    throw createError({ statusCode: 500, message: 'Tenant connection has no database name' })
  }

  const models = getTenantClientModels(conn)
  const { Campaign, CampaignRecipient } = models
  const campaignScope = mergeTenantOwnerEmailScopeFilter({ _id: campaignId }, options?.auth)

  const campaign = await (Campaign as CampaignModel)
    .findOne(campaignScope)
    .select('status')
    .lean<Pick<CampaignLean, 'status'> | null>()
  if (!campaign) throw createError({ statusCode: 404, message: 'Campaign not found' })
  if (campaign.status !== 'Paused' && campaign.status !== 'Stopped') {
    throw createError({
      statusCode: 400,
      message: 'Only paused or stopped campaigns can be sent again'
    })
  }

  const activeJob = await hasActiveCampaignSendJob(campaignId, dbName)
  if (activeJob) {
    throw createError({
      statusCode: 400,
      message: 'Campaign send is still in progress'
    })
  }

  const resetResult = await (CampaignRecipient as CampaignRecipientModel).updateMany(
    {
      campaign: campaignId,
      status: {
        $in: [
          CAMPAIGN_RECIPIENT_STATUS_SENT,
          CAMPAIGN_RECIPIENT_STATUS_FAILED,
          CAMPAIGN_RECIPIENT_STATUS_SENDING
        ]
      }
    },
    {
      $set: { status: CAMPAIGN_RECIPIENT_STATUS_PENDING },
      $unset: { error: 1, sentAt: 1, brevoMessageId: 1 }
    }
  )

  console.log('[CampaignSendControl] restartRecipients', {
    campaignId,
    dbName,
    reset: resetResult.modifiedCount ?? 0
  })

  return beginCampaignSend(conn, campaignId, {
    allowedStatuses: ['Paused', 'Stopped'],
    mode: 'retry_failed',
    auth: options?.auth,
    statusOnEnqueueFailure: campaign.status,
    ...(options?.mergeUserSnapshot ? { mergeUserSnapshot: options.mergeUserSnapshot } : {})
  })
}

/**
 * Abort selected pending recipients so they are not sent in this campaign run.
 * Only `pending` rows are aborted; in-flight `sending` rows are skipped.
 */
export async function abortCampaignRecipients(
  conn: Connection,
  campaignId: string,
  emails: string[],
  options?: { auth?: unknown }
): Promise<{
  ok: true
  campaignId: string
  aborted: number
  skipped: number
  notFound: number
  pending: number
  sent: number
  failed: number
}> {
  const rawEmails = Array.isArray(emails) ? emails : []
  const normalized = [
    ...new Set(
      rawEmails
        .map((e) => normalizeMarketingEmail(String(e ?? '')))
        .filter((e) => e.length > 0)
    )
  ]

  if (!normalized.length) {
    throw createError({ statusCode: 400, message: 'At least one email is required' })
  }
  if (normalized.length > ABORT_RECIPIENTS_MAX) {
    throw createError({
      statusCode: 400,
      message: `Cannot abort more than ${ABORT_RECIPIENTS_MAX} recipients at once`
    })
  }

  const models = getTenantClientModels(conn)
  const { Campaign, CampaignRecipient } = models
  const campaignScope = mergeTenantOwnerEmailScopeFilter({ _id: campaignId }, options?.auth)

  const campaign = await (Campaign as CampaignModel)
    .findOne(campaignScope)
    .select('_id status')
    .lean<Pick<CampaignLean, '_id' | 'status'> | null>()
  if (!campaign) throw createError({ statusCode: 404, message: 'Campaign not found' })
  if (!ACTIVE_SEND_STATUSES.includes(campaign.status as (typeof ACTIVE_SEND_STATUSES)[number])) {
    throw createError({
      statusCode: 400,
      message: 'Recipients can only be aborted while a send is active, paused, or stopped'
    })
  }

  const emailSet = new Set(normalized)
  const pendingRows = await (CampaignRecipient as CampaignRecipientModel)
    .find({
      campaign: campaignId,
      status: CAMPAIGN_RECIPIENT_STATUS_PENDING
    })
    .select('email')
    .lean<Array<{ email: string }>>()

  const emailsToAbort = pendingRows
    .map((r) => r.email)
    .filter((e) => emailSet.has(normalizeMarketingEmail(e)))

  if (!emailsToAbort.length) {
    const matchedRows = await (CampaignRecipient as CampaignRecipientModel)
      .find({ campaign: campaignId, email: { $in: normalized } })
      .select('email')
      .lean<Array<{ email: string }>>()
    const matchedSet = new Set(matchedRows.map((r) => normalizeMarketingEmail(r.email)))
    const notFound = normalized.filter((e) => !matchedSet.has(e)).length
    const skipped = normalized.length - notFound
    const counts = await recipientProgressCounts(
      CampaignRecipient as CampaignRecipientModel,
      campaignId
    )
    return {
      ok: true,
      campaignId,
      aborted: 0,
      skipped,
      notFound,
      ...counts
    }
  }

  const abortResult = await (CampaignRecipient as CampaignRecipientModel).updateMany(
    {
      campaign: campaignId,
      email: { $in: emailsToAbort },
      status: CAMPAIGN_RECIPIENT_STATUS_PENDING
    },
    {
      $set: { status: CAMPAIGN_RECIPIENT_STATUS_ABORTED, error: 'Aborted by user' },
      $unset: { brevoMessageId: 1, sentAt: 1 }
    }
  )
  const aborted = abortResult.modifiedCount ?? 0

  const statusRows = await (CampaignRecipient as CampaignRecipientModel)
    .find({ campaign: campaignId })
    .select('email status')
    .lean<Array<{ email: string; status?: string }>>()

  const statusByNorm = new Map<string, string>()
  for (const row of statusRows) {
    statusByNorm.set(normalizeMarketingEmail(row.email), String(row.status ?? ''))
  }

  const abortedStatuses = new Set<string>(CAMPAIGN_RECIPIENT_ABORTED_STATUSES)
  let notFound = 0
  let skipped = 0
  for (const email of normalized) {
    const status = statusByNorm.get(email)
    if (!status) {
      notFound++
    } else if (!abortedStatuses.has(status)) {
      skipped++
    }
  }

  if (campaign.status === 'Sending') {
    await finalizeCampaignSendIfComplete(models, campaignId)
  }

  const counts = await recipientProgressCounts(
    CampaignRecipient as CampaignRecipientModel,
    campaignId
  )

  console.log('[CampaignSendControl] abortRecipients', {
    campaignId,
    requested: normalized.length,
    aborted,
    skipped,
    notFound,
    ...counts
  })

  return {
    ok: true,
    campaignId,
    aborted,
    skipped,
    notFound,
    ...counts
  }
}
