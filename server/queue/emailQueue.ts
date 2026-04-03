import { Queue } from 'bullmq'
import { getBullMqConnectionOptions } from '../lib/bullmq'

export const EMAIL_QUEUE_NAME = 'emailQueue'
export const EMAIL_JOB_PROCESS_BATCH = 'processCampaignBatch'
/** Fires `beginCampaignSend` at `delay` for status `Scheduled` campaigns. */
export const EMAIL_JOB_START_SCHEDULED = 'startScheduledCampaign'

export function scheduledCampaignJobId(dbName: string, campaignId: string) {
  return `schedule|${dbName}|${campaignId}`
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

export async function enqueueCampaignBatch(campaignId: string, dbName: string) {
  const jobId = `${dbName}|${campaignId}`
  await getEmailQueue().add(
    EMAIL_JOB_PROCESS_BATCH,
    { campaignId, dbName },
    {
      jobId,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 1000,
      removeOnFail: 5000
    }
  )
}

export async function enqueueScheduledCampaignStart(
  campaignId: string,
  dbName: string,
  delayMs: number
) {
  const jobId = scheduledCampaignJobId(dbName, campaignId)
  const queue = getEmailQueue()
  const existing = await queue.getJob(jobId)
  if (existing) await existing.remove()

  await queue.add(
    EMAIL_JOB_START_SCHEDULED,
    { campaignId, dbName },
    {
      jobId,
      delay: Math.max(0, delayMs),
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 1000,
      removeOnFail: 5000
    }
  )
}

export async function removeScheduledCampaignJob(dbName: string, campaignId: string) {
  const job = await getEmailQueue().getJob(scheduledCampaignJobId(dbName, campaignId))
  if (job) await job.remove()
}
