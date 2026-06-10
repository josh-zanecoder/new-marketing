import { Queue, type Job } from 'bullmq'
import { isCampaignCloudTasksEnabled } from '../config/campaignCloudTasks'
import { getBullMqConnectionOptions } from '../lib/bullmq'
import {
  enqueueCampaignBatchCloudTask,
  hasCampaignBatchCloudTasks,
  removeCampaignBatchCloudTasks
} from './campaignCloudTasksQueue'
import { getTenantConnectionByDbName } from '../tenant/connection'
import { getTenantClientModels } from '../models/tenant/tenantClientModels'
import type { CampaignRecipientModel } from '../types/tenant/campaignRecipient.model'
import { CAMPAIGN_RECIPIENT_STATUS_SENDING } from '../utils/campaignSend/constants'
import { resolveCampaignSendFanoutTaskCount } from '../utils/campaignSend/batchTiming'

export const EMAIL_QUEUE_NAME = 'emailQueue'
export const EMAIL_JOB_PROCESS_BATCH = 'processCampaignBatch'
/** Fires `beginCampaignSend` at `delay` for status `Scheduled` campaigns. */
export const EMAIL_JOB_START_SCHEDULED = 'startScheduledCampaign'

const BATCH_JOB_OPTS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5000 },
  removeOnComplete: 1000,
  removeOnFail: 5000
}

export function scheduledCampaignJobId(dbName: string, campaignId: string) {
  return `schedule|${dbName}|${campaignId}`
}

/** Deterministic BullMQ job id per send run + page (dedupes duplicate enqueue). */
export function campaignBatchJobId(
  dbName: string,
  campaignId: string,
  sendRunId: string,
  page: number
) {
  const safeRun = sendRunId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80)
  return `batch|${dbName}|${campaignId}|${safeRun}|p${page}`
}

let emailQueue: Queue | null = null

export function getEmailQueue(): Queue {
  if (!emailQueue) {
    emailQueue = new Queue(EMAIL_QUEUE_NAME, {
      connection: getBullMqConnectionOptions()
    })
  }
  return emailQueue
}

function logQueue(event: string, details: Record<string, unknown>) {
  console.log(`[EmailQueue] ${event}`, details)
}

async function removeStaleJob(job: Job | undefined, context: Record<string, unknown>) {
  if (!job) return
  const state = await job.getState()
  if (state === 'completed' || state === 'failed') {
    logQueue('removeStaleJob', { jobId: job.id, name: job.name, state, ...context })
    await removeBullJobSafely(job, state, context)
  }
}

function isBullJobRemoveLockedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.includes('locked') || msg.includes('could not be removed')
}

/** Best-effort remove; never throws when the worker holds the job lock. */
async function removeBullJobSafely(
  job: Job,
  stateHint: string | undefined,
  context: Record<string, unknown>
): Promise<{ removed: boolean; state: string }> {
  const state = stateHint ?? (await job.getState())
  if (state === 'active') {
    logQueue('removeJob.skipActive', { jobId: job.id, name: job.name, state, ...context })
    return { removed: false, state }
  }
  try {
    await job.remove()
    return { removed: true, state }
  } catch (err: unknown) {
    if (isBullJobRemoveLockedError(err)) {
      logQueue('removeJob.skipLocked', {
        jobId: job.id,
        name: job.name,
        state,
        error: err instanceof Error ? err.message : String(err),
        ...context
      })
      return { removed: false, state }
    }
    throw err
  }
}

export type RemoveScheduledCampaignJobResult = {
  removed: boolean
  state?: string
  reason: 'not_found' | 'removed' | 'active' | 'locked'
}

export type CampaignQueueJobData = {
  campaignId: string
  dbName: string
  sendRunId: string
  page: number
}

function matchesCampaignJob(
  job: Job,
  campaignId: string,
  dbName: string,
  names: readonly string[]
): boolean {
  if (!names.includes(job.name)) return false
  const data = job.data as Partial<CampaignQueueJobData>
  return data.campaignId === campaignId && data.dbName === dbName
}

async function hasInFlightSendingRecipients(
  campaignId: string,
  dbName: string
): Promise<boolean> {
  try {
    const tenantConn = await getTenantConnectionByDbName(dbName)
    const { CampaignRecipient } = getTenantClientModels(tenantConn)
    const count = await (CampaignRecipient as CampaignRecipientModel).countDocuments({
      campaign: campaignId,
      status: CAMPAIGN_RECIPIENT_STATUS_SENDING
    })
    return count > 0
  } catch {
    return false
  }
}

/** True when a batch or scheduled-start job is waiting, delayed, or active for this campaign. */
export async function hasActiveCampaignSendJob(
  campaignId: string,
  dbName: string
): Promise<boolean> {
  if (isCampaignCloudTasksEnabled()) {
    if (await hasInFlightSendingRecipients(campaignId, dbName)) return true
    if (await hasCampaignBatchCloudTasks(campaignId, dbName)) return true
  }

  const queue = getEmailQueue()
  const states = ['waiting', 'active', 'delayed'] as const
  for (const state of states) {
    const jobs = await queue.getJobs([state], 0, 200)
    if (
      jobs.some((job) =>
        matchesCampaignJob(job, campaignId, dbName, [
          EMAIL_JOB_PROCESS_BATCH,
          EMAIL_JOB_START_SCHEDULED
        ])
      )
    ) {
      return true
    }
  }
  return false
}

export async function enqueueCampaignBatch(params: {
  campaignId: string
  dbName: string
  sendRunId: string
  page: number
}) {
  const { campaignId, dbName, sendRunId, page } = params

  if (isCampaignCloudTasksEnabled()) {
    await enqueueCampaignBatchCloudTask({ campaignId, dbName, sendRunId, page })
    return null
  }

  const jobId = campaignBatchJobId(dbName, campaignId, sendRunId, page)
  const queue = getEmailQueue()
  const existing = await queue.getJob(jobId)
  if (existing) {
    const state = await existing.getState()
    if (state === 'waiting' || state === 'active' || state === 'delayed') {
      logQueue('enqueueCampaignBatch.skipActive', { campaignId, dbName, jobId, state, page })
      return existing
    }
    await removeStaleJob(existing, { campaignId, dbName, page })
  }

  const job = await queue.add(
    EMAIL_JOB_PROCESS_BATCH,
    { campaignId, dbName, sendRunId, page },
    {
      jobId,
      ...BATCH_JOB_OPTS
    }
  )
  logQueue('enqueueCampaignBatch', {
    campaignId,
    dbName,
    sendRunId,
    page,
    jobId: job.id,
    queueJobId: jobId
  })
  return job
}

/** Chain the next batch page (new deterministic job id per page). */
export async function enqueueCampaignBatchFollowUp(params: {
  campaignId: string
  dbName: string
  sendRunId: string
  page: number
}) {
  return enqueueCampaignBatch(params)
}

/** Enqueue multiple batch tasks in parallel (pages startPage … startPage+count-1). */
export async function enqueueCampaignBatchFanOut(params: {
  campaignId: string
  dbName: string
  sendRunId: string
  startPage?: number
  pendingEstimate?: number
  count?: number
}): Promise<number> {
  const { campaignId, dbName, sendRunId } = params
  const startPage = Math.max(0, Number(params.startPage ?? 0))
  const taskCount =
    params.count != null && params.count > 0
      ? Math.floor(params.count)
      : resolveCampaignSendFanoutTaskCount(params.pendingEstimate ?? 0)

  await Promise.all(
    Array.from({ length: taskCount }, (_, i) =>
      enqueueCampaignBatch({
        campaignId,
        dbName,
        sendRunId,
        page: startPage + i
      })
    )
  )

  logQueue('enqueueCampaignBatchFanOut', {
    campaignId,
    dbName,
    sendRunId,
    startPage,
    taskCount,
    pendingEstimate: params.pendingEstimate ?? null
  })
  return taskCount
}

export async function enqueueScheduledCampaignStart(
  campaignId: string,
  dbName: string,
  delayMs: number
) {
  const jobId = scheduledCampaignJobId(dbName, campaignId)
  const queue = getEmailQueue()
  const existing = await queue.getJob(jobId)
  if (existing) {
    const state = await existing.getState()
    logQueue('replaceScheduledJob', { campaignId, dbName, jobId, state })
    const removed = await removeBullJobSafely(existing, state, { campaignId, dbName })
    if (!removed.removed && state === 'active') {
      throw new Error(
        `Cannot reschedule while the scheduled send job is running (${jobId})`
      )
    }
  }

  const job = await queue.add(
    EMAIL_JOB_START_SCHEDULED,
    { campaignId, dbName, sendRunId: '', page: 0 },
    {
      jobId,
      delay: Math.max(0, delayMs),
      ...BATCH_JOB_OPTS
    }
  )
  logQueue('enqueueScheduledCampaignStart', {
    campaignId,
    dbName,
    delayMs,
    jobId: job.id,
    queueJobId: jobId
  })
  return job
}

/** Remove waiting/delayed batch jobs for a campaign (active jobs no-op via sendRunId guard). */
export async function removeCampaignBatchJobs(
  campaignId: string,
  dbName: string
): Promise<number> {
  let removed = 0
  if (isCampaignCloudTasksEnabled()) {
    removed += await removeCampaignBatchCloudTasks(campaignId, dbName)
  }

  const queue = getEmailQueue()
  for (const state of ['waiting', 'delayed'] as const) {
    const jobs = await queue.getJobs([state], 0, 500)
    for (const job of jobs) {
      if (!matchesCampaignJob(job, campaignId, dbName, [EMAIL_JOB_PROCESS_BATCH])) continue
      const result = await removeBullJobSafely(job, state, { campaignId, dbName })
      if (result.removed) removed += 1
    }
  }
  if (removed > 0) {
    logQueue('removeCampaignBatchJobs', { campaignId, dbName, removed })
  }
  return removed
}

export async function removeScheduledCampaignJob(
  dbName: string,
  campaignId: string
): Promise<RemoveScheduledCampaignJobResult> {
  const jobId = scheduledCampaignJobId(dbName, campaignId)
  const job = await getEmailQueue().getJob(jobId)
  if (!job) {
    return { removed: true, reason: 'not_found' }
  }
  const state = await job.getState()
  logQueue('removeScheduledCampaignJob', { campaignId, dbName, jobId: job.id, state })
  const result = await removeBullJobSafely(job, state, { campaignId, dbName })
  if (result.removed) return { removed: true, state: result.state, reason: 'removed' }
  if (result.state === 'active') {
    return { removed: false, state: result.state, reason: 'active' }
  }
  return { removed: false, state: result.state, reason: 'locked' }
}
