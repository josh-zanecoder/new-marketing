import { Queue } from 'bullmq'
import { getBullMqConnectionOptions } from '../utils/bullmqConnection'

export const EMAIL_QUEUE_NAME = 'emailQueue'
export const EMAIL_JOB_PROCESS_BATCH = 'processCampaignBatch'

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
  await getEmailQueue().add(
    EMAIL_JOB_PROCESS_BATCH,
    { campaignId, dbName },
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 1000,
      removeOnFail: 5000
    }
  )
}
