import {
  enqueueCampaignBatchFollowUp,
  type CampaignQueueJobData
} from '../queue/emailQueue'
import { getTenantClientModels } from '../models/tenant/tenantClientModels'
import { notifyCampaignSendCompleted } from '../campaign-delivery/notifyCampaignSendCompleted'
import { getTenantConnectionByDbName } from '../tenant/connection'
import { processBatch } from './send-campaign.service'

function jobLog(event: string, details: Record<string, unknown>) {
  console.log(`[CampaignBatchJob] ${event}`, details)
}

/**
 * Shared batch runner for BullMQ EmailWorker and Cloud Tasks HTTP handler.
 * Preserves develop's serial page chain (claim → send → enqueue next page).
 */
export async function runCampaignBatchJob(data: CampaignQueueJobData): Promise<void> {
  const { campaignId, dbName } = data
  const sendRunId = String(data.sendRunId || '')
  const page = Math.max(0, Number(data.page ?? 0))
  const startedAt = Date.now()

  if (!dbName) throw new Error('Campaign batch job missing dbName (tenant database)')
  if (!sendRunId) throw new Error('Campaign batch job missing sendRunId')

  jobLog('start', { campaignId, dbName, sendRunId, page })

  const tenantConn = await getTenantConnectionByDbName(dbName)
  const models = getTenantClientModels(tenantConn)
  const result = await processBatch(models, campaignId, { sendRunId, page })

  if (result.skipped) {
    jobLog('skipped', { campaignId, dbName, sendRunId, page })
    return
  }

  if (!result.done) {
    if (result.chainNext === false) {
      jobLog('deferChain', {
        campaignId,
        dbName,
        sendRunId,
        page,
        pending: result.pending,
        sent: result.sent,
        failed: result.failed,
        processedInBatch: result.processedInBatch,
        ms: Date.now() - startedAt
      })
      return
    }

    const processed = result.processedInBatch ?? 0
    const nextPage = processed > 0 ? page + 1 : page
    await enqueueCampaignBatchFollowUp({
      campaignId,
      dbName,
      sendRunId,
      page: nextPage
    })
    jobLog('continue', {
      campaignId,
      dbName,
      sendRunId,
      page,
      nextPage,
      processedInBatch: processed,
      pending: result.pending,
      sent: result.sent,
      failed: result.failed,
      ms: Date.now() - startedAt
    })
    return
  }

  await notifyCampaignSendCompleted({
    tenantDbName: dbName,
    campaignId,
    campaignStatus: result.campaignStatus,
    sent: result.sent,
    failed: result.failed,
    total: result.total
  })
  jobLog('complete', {
    campaignId,
    dbName,
    sendRunId,
    page,
    campaignStatus: result.campaignStatus,
    sent: result.sent,
    failed: result.failed,
    total: result.total,
    ms: Date.now() - startedAt
  })
}
