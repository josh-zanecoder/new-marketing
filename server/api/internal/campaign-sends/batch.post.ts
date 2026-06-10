import { createError, defineEventHandler, getHeader, readBody, setResponseStatus } from 'h3'
import { getCampaignCloudTasksConfig } from '../../../config/campaignCloudTasks'
import {
  parseCampaignBatchWorkerBody,
  processCampaignBatchWorkerTask
} from '../../../services/campaignBatchWorker.service'

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
  const data = parseCampaignBatchWorkerBody(raw)

  const result = await processCampaignBatchWorkerTask(data)

  // Always 200 for Cloud Tasks (ratesheet pattern): app-level retry, no CT retry storms.
  setResponseStatus(event, 200)
  return result
})
