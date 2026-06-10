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

async function fanOutMoreWork(params: {
  campaignId: string
  dbName: string
  sendRunId: string
  startPage: number
  pendingEstimate?: number
  reason: string
  page: number
  startedAt: number
}) {
  await enqueueCampaignBatchFanOut({
    campaignId: params.campaignId,
    dbName: params.dbName,
    sendRunId: params.sendRunId,
    startPage: params.startPage,
    pendingEstimate: params.pendingEstimate
  })
  jobLog('fanOutRestart', {
    campaignId: params.campaignId,
    dbName: params.dbName,
    sendRunId: params.sendRunId,
    page: params.page,
    startPage: params.startPage,
    pending: params.pendingEstimate ?? null,
    reason: params.reason,
    ms: Date.now() - params.startedAt
  })
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

  const outstanding = result.outstanding ?? result.pending ?? 0

  if (!result.done) {
    if (result.chainNext === false) {
      if (outstanding > 0) {
        await fanOutMoreWork({
          campaignId,
          dbName,
          sendRunId,
          startPage: page,
          pendingEstimate: outstanding,
          reason: 'waitingInFlight',
          page,
          startedAt
        })
        return
      }
      jobLog('deferChain', {
        campaignId,
        dbName,
        sendRunId,
        page,
        outstanding,
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
        outstanding,
        ms: Date.now() - startedAt
      })
      return
    }

    await fanOutMoreWork({
      campaignId,
      dbName,
      sendRunId,
      startPage: page,
      pendingEstimate: outstanding,
      reason: 'emptyClaim',
      page,
      startedAt
    })
    return
  }

  if (outstanding > 0) {
    await fanOutMoreWork({
      campaignId,
      dbName,
      sendRunId,
      startPage: page,
      pendingEstimate: outstanding,
      reason: 'doneWithOutstanding',
      page,
      startedAt
    })
    return
  }

  if (result.campaignStatus === 'Sending') {
    jobLog('complete.awaitFinalize', {
      campaignId,
      dbName,
      sendRunId,
      page,
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
