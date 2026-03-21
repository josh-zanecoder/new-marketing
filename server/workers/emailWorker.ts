import { Worker } from 'bullmq'
import { getBullMqConnectionOptions } from '../lib/bullmq'
import { getTenantClientModels } from '../models/tenant/tenantClientModels'
import { EMAIL_JOB_PROCESS_BATCH, EMAIL_QUEUE_NAME, getEmailQueue } from '../queue/emailQueue'
import { processBatch } from '../services/send-campaign.service'
import { getTenantConnectionByDbName } from '../tenant/connection'

let worker: Worker | null = null

export function startEmailWorker() {
  const g = globalThis as typeof globalThis & { __emailWorkerStarted?: boolean }
  if (g.__emailWorkerStarted || worker) return
  g.__emailWorkerStarted = true

  worker = new Worker(
    EMAIL_QUEUE_NAME,
    async (job) => {
      if (job.name !== EMAIL_JOB_PROCESS_BATCH) return

      const { campaignId, dbName } = job.data as { campaignId: string; dbName: string }
      if (!dbName) {
        throw new Error('Email job missing dbName (tenant database)')
      }
      const tenantConn = await getTenantConnectionByDbName(dbName)
      const models = getTenantClientModels(tenantConn)

      const result = await processBatch(models, campaignId)

      if (!result.done) {
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
