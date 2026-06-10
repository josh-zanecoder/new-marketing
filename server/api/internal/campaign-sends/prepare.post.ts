import { createError, defineEventHandler, getHeader, readBody, setResponseStatus } from 'h3'
import { getCampaignCloudTasksConfig } from '../../../config/campaignCloudTasks'
import {
  materializeCampaignRecipientsAndEnqueue,
  type CampaignPrepareJobData
} from '../../../services/prepareCampaignSend.service'
import { getTenantConnectionByDbName } from '../../../tenant/connection'

function parsePrepareBody(raw: unknown): CampaignPrepareJobData {
  if (!raw || typeof raw !== 'object') {
    throw createError({ statusCode: 400, message: 'Invalid campaign prepare payload' })
  }
  const body = raw as Partial<CampaignPrepareJobData>
  const campaignId = String(body.campaignId || '').trim()
  const dbName = String(body.dbName || '').trim()
  const sendRunId = String(body.sendRunId || '').trim()
  const mode = body.mode === 'resend_all' ? 'resend_all' : 'new'
  const revertStatus = body.revertStatus ? String(body.revertStatus) : undefined

  if (!campaignId || !dbName || !sendRunId) {
    throw createError({
      statusCode: 400,
      message: 'campaignId, dbName, and sendRunId are required'
    })
  }

  return { campaignId, dbName, sendRunId, mode, revertStatus }
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

  const data = parsePrepareBody(await readBody(event))
  const conn = await getTenantConnectionByDbName(data.dbName)
  const result = await materializeCampaignRecipientsAndEnqueue(conn, data)

  setResponseStatus(event, 200)
  return { ok: true, ...result }
})
