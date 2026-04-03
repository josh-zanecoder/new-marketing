import { Worker } from 'bullmq'
import { getBullMqConnectionOptions } from '../lib/bullmq'
import { getTenantClientModels } from '../models/tenant/tenantClientModels'
import type { CampaignLean, CampaignModel } from '../types/tenant/campaign.model'
import {
  EMAIL_JOB_PROCESS_BATCH,
  EMAIL_JOB_START_SCHEDULED,
  EMAIL_QUEUE_NAME,
  getEmailQueue
} from '../queue/emailQueue'
import { beginCampaignSend, processBatch } from '../services/send-campaign.service'
import { publishCampaignSendCompleted } from '../services/kafkaProducer'
import { getTenantConnectionByDbName } from '../tenant/connection'

const G = globalThis as typeof globalThis & { __emailBullWorker?: Worker | null }

export function startEmailWorker() {
  if (G.__emailBullWorker) return

  G.__emailBullWorker = new Worker(
    EMAIL_QUEUE_NAME,
    async (job) => {
      const { campaignId, dbName } = job.data as { campaignId: string; dbName: string }

      if (job.name === EMAIL_JOB_START_SCHEDULED) {
        if (!dbName) {
          throw new Error('Scheduled send job missing dbName (tenant database)')
        }
        const tenantConn = await getTenantConnectionByDbName(dbName)
        const models = getTenantClientModels(tenantConn)
        const { Campaign } = models
        const c = await (Campaign as CampaignModel).findById(campaignId).lean<CampaignLean | null>()
        if (!c) {
          console.warn('[EmailWorker] startScheduled: campaign not found', { campaignId, dbName })
          return
        }
        if (c.status !== 'Scheduled') {
          console.warn('[EmailWorker] startScheduled: skipped (not Scheduled)', {
            campaignId,
            dbName,
            status: c.status
          })
          return
        }
        console.log('[EmailWorker] startScheduled: begin send', { campaignId, dbName })
        try {
          await beginCampaignSend(tenantConn, campaignId, {
            allowedStatuses: ['Scheduled'],
            statusOnEnqueueFailure: 'Scheduled'
          })
        } catch (err: unknown) {
          let msg = err instanceof Error ? err.message : String(err)
          if (err && typeof err === 'object') {
            const o = err as { statusMessage?: string; message?: string; data?: { message?: string } }
            if (typeof o.statusMessage === 'string') msg = o.statusMessage
            else if (typeof o.message === 'string') msg = o.message
            else if (typeof o.data?.message === 'string') msg = o.data.message
          }
          console.error('[EmailWorker] startScheduled: beginCampaignSend failed', {
            campaignId,
            dbName,
            message: msg
          })
          throw err
        }
        return
      }

      if (job.name !== EMAIL_JOB_PROCESS_BATCH) return
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
      } else {
        await publishCampaignSendCompleted({
          tenantDbName: dbName,
          campaignId,
          campaignStatus: result.campaignStatus,
          sent: result.sent,
          failed: result.failed,
          total: result.total
        })
      }
    },
    {
      connection: getBullMqConnectionOptions(),
      concurrency: 1
    }
  )

  G.__emailBullWorker.on('ready', () => {
    console.log(`[EmailWorker] ready (queue=${EMAIL_QUEUE_NAME})`)
  })
  G.__emailBullWorker.on('completed', (job) => {
    console.log(`[EmailWorker] Job ${job.id} completed`)
  })
  G.__emailBullWorker.on('failed', (job, err) => {
    console.error(`[EmailWorker] Job ${job?.id} failed:`, err?.message ?? err)
  })
}
