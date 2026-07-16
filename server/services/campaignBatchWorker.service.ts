import { createError } from 'h3'
import type { CampaignQueueJobData } from '../queue/emailQueue'
import { enqueueCampaignBatch } from '../queue/emailQueue'
import { runCampaignBatchJob } from './runCampaignBatchJob'
import {
  CAMPAIGN_SEND_MAX_RETRY_ATTEMPTS,
  CAMPAIGN_SEND_RETRY_BASE_DELAY_MS
} from '../utils/campaignSend/constants'

export type CampaignBatchWorkerResult =
  | { ok: true; skipped?: boolean; reason?: string }
  | { ok: true; queuedRetry: true; retryAttempt: number; delayMs: number }
  | { ok: true; terminalFailure: true; reason: string }

function workerLog(event: string, details: Record<string, unknown>) {
  console.log(`[CampaignBatchWorker] ${event}`, details)
}

function maxRetryAttempts(): number {
  return Math.max(
    0,
    Number(process.env.CAMPAIGN_SEND_MAX_RETRY_ATTEMPTS || CAMPAIGN_SEND_MAX_RETRY_ATTEMPTS)
  )
}

function retryBaseDelayMs(): number {
  return Math.max(
    250,
    Number(process.env.CAMPAIGN_SEND_RETRY_BASE_DELAY_MS || CAMPAIGN_SEND_RETRY_BASE_DELAY_MS)
  )
}

export async function processCampaignBatchWorkerTask(
  data: CampaignQueueJobData
): Promise<CampaignBatchWorkerResult> {
  workerLog('task.received', {
    campaignId: data.campaignId,
    dbName: data.dbName,
    sendRunId: data.sendRunId,
    page: data.page,
    retryAttempt: data.retryAttempt ?? 0
  })

  try {
    await runCampaignBatchJob(data)
    return { ok: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    const retryAttempt = Math.max(0, Number(data.retryAttempt || 0))
    const maxAttempts = maxRetryAttempts()

    if (retryAttempt < maxAttempts) {
      const nextAttempt = retryAttempt + 1
      const delayMs = retryBaseDelayMs() * Math.pow(2, retryAttempt)
      await enqueueCampaignBatch({
        ...data,
        retryAttempt: nextAttempt,
        delayMs
      })
      workerLog('task.retryQueued', {
        campaignId: data.campaignId,
        dbName: data.dbName,
        page: data.page,
        retryAttempt: nextAttempt,
        delayMs,
        error: message
      })
      return { ok: true, queuedRetry: true, retryAttempt: nextAttempt, delayMs }
    }

    workerLog('task.terminalFailure', {
      campaignId: data.campaignId,
      dbName: data.dbName,
      page: data.page,
      retryAttempt,
      error: message
    })
    return { ok: true, terminalFailure: true, reason: 'max_retries_exhausted' }
  }
}

export function parseCampaignBatchWorkerBody(raw: unknown): CampaignQueueJobData {
  if (!raw || typeof raw !== 'object') {
    throw createError({ statusCode: 400, message: 'Invalid campaign batch payload' })
  }
  const body = raw as Partial<CampaignQueueJobData>
  const campaignId = String(body.campaignId || '').trim()
  const dbName = String(body.dbName || '').trim()
  const sendRunId = String(body.sendRunId || '').trim()
  const page = Math.max(0, Number(body.page ?? 0))
  const retryAttempt = Math.max(0, Number(body.retryAttempt ?? 0))
  const delayMs = Math.max(0, Number(body.delayMs ?? 0))

  if (!campaignId || !dbName || !sendRunId) {
    throw createError({
      statusCode: 400,
      message: 'campaignId, dbName, and sendRunId are required'
    })
  }

  return { campaignId, dbName, sendRunId, page, retryAttempt, delayMs }
}
