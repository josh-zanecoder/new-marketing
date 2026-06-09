import { createError, defineEventHandler, getHeader, readBody } from 'h3'
import type { CampaignQueueJobData } from '../../../queue/emailQueue'
import { getCampaignCloudTasksConfig } from '../../../config/campaignCloudTasks'
import { runCampaignBatchJob } from '../../../services/runCampaignBatchJob'

function parseWorkerBody(raw: unknown): CampaignQueueJobData {
  if (!raw || typeof raw !== 'object') {
    throw createError({ statusCode: 400, message: 'Invalid campaign batch payload' })
  }
  const body = raw as Partial<CampaignQueueJobData>
  const campaignId = String(body.campaignId || '').trim()
  const dbName = String(body.dbName || '').trim()
  const sendRunId = String(body.sendRunId || '').trim()
  const page = Math.max(0, Number(body.page ?? 0))

  if (!campaignId || !dbName || !sendRunId) {
    throw createError({
      statusCode: 400,
      message: 'campaignId, dbName, and sendRunId are required'
    })
  }

  return { campaignId, dbName, sendRunId, page }
}

export default defineEventHandler(async (event) => {
  const cfg = getCampaignCloudTasksConfig()
  const secret =
    getHeader(event, 'x-campaign-send-worker-secret') ||
    getHeader(event, 'X-Campaign-Send-Worker-Secret') ||
    ''

  if (!cfg.workerSecret || secret !== cfg.workerSecret) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const raw = await readBody(event)
  const data = parseWorkerBody(raw)

  console.log('[CampaignBatchWorker] task.received', {
    campaignId: data.campaignId,
    dbName: data.dbName,
    sendRunId: data.sendRunId,
    page: data.page,
    cloudTask: getHeader(event, 'x-cloudtasks-taskname') || null
  })

  try {
    await runCampaignBatchJob(data)
    return { ok: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[CampaignBatchWorker] task.failed', {
      campaignId: data.campaignId,
      dbName: data.dbName,
      page: data.page,
      message
    })
    throw createError({ statusCode: 500, message })
  }
})
