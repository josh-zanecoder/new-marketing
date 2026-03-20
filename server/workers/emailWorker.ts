import { Worker } from 'bullmq'
import { getRegistryConnection } from '../utils/db'
import { getBullMqConnectionOptions } from '../utils/bullmqConnection'
import { EMAIL_JOB_PROCESS_BATCH, EMAIL_QUEUE_NAME, getEmailQueue } from '../queue/emailQueue'
import { processBatch } from '../services/send-campaign.service'

let worker: Worker | null = null

export function startEmailWorker() {
  const g = globalThis as typeof globalThis & { __emailWorkerStarted?: boolean }
  if (g.__emailWorkerStarted || worker) return
  g.__emailWorkerStarted = true

  worker = new Worker(
    EMAIL_QUEUE_NAME,
    async (job) => {
      if (job.name !== EMAIL_JOB_PROCESS_BATCH) return

      const { campaignId } = job.data as { campaignId: string }
      await getRegistryConnection()

      const result = await processBatch(campaignId)

      if (!result.done) {
        await getEmailQueue().add(
          EMAIL_JOB_PROCESS_BATCH,
          { campaignId },
          {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: 1000,
            removeOnFail: 5000
          }
        )
      }
    },
    {
      connection: getBullMqConnectionOptions(),
      concurrency: 1
    }
  )

  worker.on('completed', (job) => {
    console.log(`[EmailWorker] Job ${job.id} completed`)
  })
  worker.on('failed', (job, err) => {
    console.error(`[EmailWorker] Job ${job?.id} failed:`, err?.message ?? err)
  })
}
