import { Queue, type Job } from 'bullmq'
import { getBullMqConnectionOptions } from '../lib/bullmq'

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

/** True when a batch or scheduled-start job is waiting, delayed, or active for this campaign. */
export async function hasActiveCampaignSendJob(
  campaignId: string,
  dbName: string
): Promise<boolean> {
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
