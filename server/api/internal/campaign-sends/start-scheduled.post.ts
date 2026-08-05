import { createError, defineEventHandler, getHeader, readBody, setResponseStatus } from 'h3'
import { getCampaignCloudTasksConfig } from '../../../config/campaignCloudTasks'
import { getTenantConnectionByDbName } from '../../../tenant/connection'
import { getTenantClientModels } from '../../../models/tenant/tenantClientModels'
import type { CampaignLean, CampaignModel } from '../../../types/tenant/campaign.model'
import { beginCampaignSend } from '../../../services/send-campaign.service'

function logSched(event: string, details: Record<string, unknown>) {
  console.log(`[CampaignScheduleWorker] ${event}`, details)
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
  if (!raw || typeof raw !== 'object') {
    throw createError({ statusCode: 400, message: 'Invalid schedule start payload' })
  }

  const body = raw as { campaignId?: string; dbName?: string; kind?: string }
  const campaignId = String(body.campaignId || '').trim()
  const dbName = String(body.dbName || '').trim()

  if (!campaignId || !dbName) {
    throw createError({ statusCode: 400, message: 'campaignId and dbName are required' })
  }

  const startedAt = Date.now()
  logSched('task.received', { campaignId, dbName, kind: body.kind })

  try {
    const tenantConn = await getTenantConnectionByDbName(dbName)
    const { Campaign } = getTenantClientModels(tenantConn)
    const campaign = await (Campaign as CampaignModel)
      .findById(campaignId)
      .lean<CampaignLean | null>()

    if (!campaign) {
      logSched('skipped.notFound', { campaignId, dbName })
      setResponseStatus(event, 200)
      return { ok: true, skipped: true, reason: 'not_found' }
    }

    if (campaign.status !== 'Scheduled') {
      logSched('skipped.status', { campaignId, dbName, status: campaign.status })
      setResponseStatus(event, 200)
      return { ok: true, skipped: true, reason: 'not_scheduled', status: campaign.status }
    }

    const result = await beginCampaignSend(tenantConn, campaignId, {
      allowedStatuses: ['Scheduled'],
      statusOnEnqueueFailure: 'Scheduled',
      awaitUnsubscribeApproval: false
    })

    if ('needsUnsubscribeApproval' in result && result.needsUnsubscribeApproval) {
      logSched('skipped.unsubscribeApproval', { campaignId, dbName })
      setResponseStatus(event, 200)
      return { ok: true, skipped: true, reason: 'unsubscribe_approval' }
    }

    logSched('done', {
      campaignId,
      dbName,
      sendRunId: result.sendRunId,
      queued: result.queued,
      valid: result.valid,
      invalid: result.invalid,
      ms: Date.now() - startedAt
    })

    // Always 200 for Cloud Tasks: avoid CT retry storms; app/reconcile can recover.
    setResponseStatus(event, 200)
    return result
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    logSched('failed', { campaignId, dbName, message, ms: Date.now() - startedAt })
    // Return 200 so Cloud Tasks does not hammer retries; reconcile will pick overdue sends up.
    setResponseStatus(event, 200)
    return { ok: false, error: message }
  }
})
