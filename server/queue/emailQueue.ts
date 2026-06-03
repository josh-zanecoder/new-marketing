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

export function campaignBatchJobId(dbName: string, campaignId: string) {
  return `${dbName}|${campaignId}`
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
    await job.remove()
  }
}

export type CampaignQueueJobData = { campaignId: string; dbName: string }

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

export async function enqueueCampaignBatch(campaignId: string, dbName: string) {
  const jobId = campaignBatchJobId(dbName, campaignId)
  const queue = getEmailQueue()
  const existing = await queue.getJob(jobId)
  if (existing) {
    const state = await existing.getState()
    if (state === 'waiting' || state === 'active' || state === 'delayed') {
      logQueue('enqueueCampaignBatch.skipActive', { campaignId, dbName, jobId, state })
      return existing
    }
    await removeStaleJob(existing, { campaignId, dbName })
  }

  const job = await queue.add(
    EMAIL_JOB_PROCESS_BATCH,
    { campaignId, dbName },
    {
      jobId,
      ...BATCH_JOB_OPTS
    }
  )
  logQueue('enqueueCampaignBatch', {
    campaignId,
    dbName,
    jobId: job.id,
    queueJobId: jobId
  })
  return job
}

/** Chain the next batch without a fixed jobId so completed/failed head jobs do not block progress. */
export async function enqueueCampaignBatchFollowUp(campaignId: string, dbName: string) {
  const queue = getEmailQueue()
  const job = await queue.add(
    EMAIL_JOB_PROCESS_BATCH,
    { campaignId, dbName },
    { ...BATCH_JOB_OPTS }
  )
  logQueue('enqueueCampaignBatchFollowUp', {
    campaignId,
    dbName,
    jobId: job.id
  })
  return job
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
    await existing.remove()
  }

  const job = await queue.add(
    EMAIL_JOB_START_SCHEDULED,
    { campaignId, dbName },
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

export async function removeScheduledCampaignJob(dbName: string, campaignId: string) {
  const job = await getEmailQueue().getJob(scheduledCampaignJobId(dbName, campaignId))
  if (job) {
    logQueue('removeScheduledCampaignJob', { campaignId, dbName, jobId: job.id })
    await job.remove()
  }
}
