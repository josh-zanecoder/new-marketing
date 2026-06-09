import {
  enqueueCampaignBatch,
  enqueueCampaignBatchFanOut,
  type CampaignQueueJobData
} from '../queue/emailQueue'
import { getTenantClientModels } from '../models/tenant/tenantClientModels'
import { notifyCampaignSendCompleted } from '../kafka/notifyCampaignSendCompleted'
import { getTenantConnectionByDbName } from '../tenant/connection'
import { processBatch } from './send-campaign.service'
import { resolveCampaignSendFanoutCount } from '../utils/campaignSend/batchTiming'

function jobLog(event: string, details: Record<string, unknown>) {
  console.log(`[CampaignBatchJob] ${event}`, details)
}

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
    const fanout = resolveCampaignSendFanoutCount()

    if (processed > 0) {
      const nextPage = page + fanout
      await enqueueCampaignBatch({
        campaignId,
        dbName,
        sendRunId,
        page: nextPage
      })
      jobLog('replenish', {
        campaignId,
        dbName,
        sendRunId,
        page,
        nextPage,
        fanout,
        processedInBatch: processed,
        pending: result.pending,
        ms: Date.now() - startedAt
      })
      return
    }

    await enqueueCampaignBatchFanOut({
      campaignId,
      dbName,
      sendRunId,
      startPage: page,
      pendingEstimate: result.pending
    })
    jobLog('fanOutRestart', {
      campaignId,
      dbName,
      sendRunId,
      page,
      pending: result.pending,
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
