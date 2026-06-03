import { Worker } from 'bullmq'
import { getBullMqConnectionOptions } from '../lib/bullmq'
import { getTenantClientModels } from '../models/tenant/tenantClientModels'
import type { CampaignLean, CampaignModel } from '../types/tenant/campaign.model'
import {
  EMAIL_JOB_PROCESS_BATCH,
  EMAIL_JOB_START_SCHEDULED,
  EMAIL_QUEUE_NAME,
  enqueueCampaignBatch,
  enqueueCampaignBatchFollowUp,
  getEmailQueue
} from '../queue/emailQueue'
import {
  beginCampaignSend,
  finalizeCampaignSendIfComplete,
  processBatch
} from '../services/send-campaign.service'
import { publishCampaignSendCompleted } from '../kafka/kafkaProducer'
import { getTenantConnectionByDbName } from '../tenant/connection'

const G = globalThis as typeof globalThis & { __emailBullWorker?: Worker | null }

function jobLog(event: string, details: Record<string, unknown>) {
  console.log(`[EmailWorker] ${event}`, details)
}

function jobError(event: string, details: Record<string, unknown>) {
  console.error(`[EmailWorker] ${event}`, details)
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object') {
    const o = err as { statusMessage?: string; message?: string; data?: { message?: string } }
    if (typeof o.statusMessage === 'string') return o.statusMessage
    if (typeof o.message === 'string') return o.message
    if (typeof o.data?.message === 'string') return o.data.message
  }
  return String(err)
}

async function recoverFailedBatchJob(
  campaignId: string,
  dbName: string,
  reason: string
): Promise<void> {
  try {
    const tenantConn = await getTenantConnectionByDbName(dbName)
    const models = getTenantClientModels(tenantConn)
    const finalized = await finalizeCampaignSendIfComplete(models, campaignId)
    if (finalized.finalized) {
      jobLog('recover.finalized', { campaignId, dbName, status: finalized.status, reason })
      return
    }
    if ((finalized.pending ?? 0) > 0) {
      await enqueueCampaignBatch(campaignId, dbName)
      jobLog('recover.requeued', {
        campaignId,
        dbName,
        pending: finalized.pending,
        reason
      })
    }
  } catch (err: unknown) {
    jobError('recover.failed', {
      campaignId,
      dbName,
      reason,
      message: errorMessage(err)
    })
  }
}

export function startEmailWorker() {
  if (G.__emailBullWorker) return

  G.__emailBullWorker = new Worker(
    EMAIL_QUEUE_NAME,
    async (job) => {
      const { campaignId, dbName } = job.data as { campaignId: string; dbName: string }
      const startedAt = Date.now()
      jobLog('job.start', {
        jobId: job.id,
        name: job.name,
        campaignId,
        dbName,
        attempt: job.attemptsMade + 1,
        maxAttempts: job.opts.attempts ?? 1
      })

      if (job.name === EMAIL_JOB_START_SCHEDULED) {
        if (!dbName) {
          throw new Error('Scheduled send job missing dbName (tenant database)')
        }
        const tenantConn = await getTenantConnectionByDbName(dbName)
        const models = getTenantClientModels(tenantConn)
        const { Campaign } = models
        const c = await (Campaign as CampaignModel).findById(campaignId).lean<CampaignLean | null>()
        if (!c) {
          jobError('startScheduled.campaignNotFound', { campaignId, dbName })
          return
        }
        if (c.status !== 'Scheduled') {
          jobLog('startScheduled.skipped', {
            campaignId,
            dbName,
            status: c.status
          })
          return
        }
        try {
          const result = await beginCampaignSend(tenantConn, campaignId, {
            allowedStatuses: ['Scheduled'],
            statusOnEnqueueFailure: 'Scheduled'
          })
          jobLog('startScheduled.done', {
            campaignId,
            dbName,
            queued: result.queued,
            valid: result.valid,
            invalid: result.invalid,
            ms: Date.now() - startedAt
          })
        } catch (err: unknown) {
          jobError('startScheduled.failed', {
            campaignId,
            dbName,
            message: errorMessage(err)
          })
          throw err
        }
        return
      }

      if (job.name !== EMAIL_JOB_PROCESS_BATCH) {
        jobLog('job.ignored', { jobId: job.id, name: job.name })
        return
      }
      if (!dbName) {
        throw new Error('Email job missing dbName (tenant database)')
      }
      const tenantConn = await getTenantConnectionByDbName(dbName)
      const models = getTenantClientModels(tenantConn)

      const result = await processBatch(models, campaignId)

      if (!result.done) {
        await enqueueCampaignBatchFollowUp(campaignId, dbName)
        jobLog('batch.continue', {
          campaignId,
          dbName,
          pending: result.pending,
          sent: result.sent,
          failed: result.failed,
          ms: Date.now() - startedAt
        })
      } else {
        await publishCampaignSendCompleted({
          tenantDbName: dbName,
          campaignId,
          campaignStatus: result.campaignStatus,
          sent: result.sent,
          failed: result.failed,
          total: result.total
        })
        jobLog('batch.complete', {
          campaignId,
          dbName,
          campaignStatus: result.campaignStatus,
          sent: result.sent,
          failed: result.failed,
          total: result.total,
          ms: Date.now() - startedAt
        })
      }
    },
    {
      connection: getBullMqConnectionOptions(),
      concurrency: 3
    }
  )

  G.__emailBullWorker.on('ready', () => {
    jobLog('ready', { queue: EMAIL_QUEUE_NAME })
  })
  G.__emailBullWorker.on('completed', (job) => {
    jobLog('job.completed', { jobId: job.id, name: job.name })
  })
  G.__emailBullWorker.on('failed', (job, err) => {
    const maxAttempts = job?.opts?.attempts ?? 1
    const attempt = job?.attemptsMade ?? 0
    const isFinal = attempt >= maxAttempts
    jobError('job.failed', {
      jobId: job?.id,
      name: job?.name,
      attempt,
      maxAttempts,
      isFinal,
      message: err?.message ?? String(err)
    })

    if (!job || !isFinal) return
    const data = job.data as { campaignId?: string; dbName?: string }
    const campaignId = data.campaignId
    const dbName = data.dbName
    if (!campaignId || !dbName) return

    if (job.name === EMAIL_JOB_PROCESS_BATCH) {
      void recoverFailedBatchJob(campaignId, dbName, 'batch job exhausted retries')
    } else if (job.name === EMAIL_JOB_START_SCHEDULED) {
      jobError('startScheduled.exhausted', { campaignId, dbName })
    }
  })

  G.__emailBullWorker.on('error', (err) => {
    jobError('worker.error', { message: err?.message ?? String(err) })
  })

  void getEmailQueue().waitUntilReady().then(() => {
    jobLog('queue.connected', { queue: EMAIL_QUEUE_NAME })
  }).catch((err) => {
    jobError('queue.connectFailed', { message: errorMessage(err) })
  })
}
