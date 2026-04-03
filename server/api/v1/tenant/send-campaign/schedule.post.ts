import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import {
  enqueueScheduledCampaignStart,
  removeScheduledCampaignJob
} from '@server/queue/emailQueue'
import type { CampaignLean, CampaignModel } from '@server/types/tenant/campaign.model'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { tenantUserFieldsFromAuth } from '@server/utils/emailMerge/tenantUserFromAuth'

const MIN_LEAD_MS = 60_000

export default defineEventHandler(async (event) => {
  const body = await readBody<{ campaignId: string; scheduledAt: string }>(event)
  const campaignId = body?.campaignId
  const scheduledAtRaw = body?.scheduledAt
  if (!campaignId) throw createError({ statusCode: 400, message: 'campaignId is required' })
  if (!scheduledAtRaw?.trim()) {
    throw createError({ statusCode: 400, message: 'scheduledAt is required' })
  }

  const when = new Date(scheduledAtRaw)
  if (Number.isNaN(when.getTime())) {
    throw createError({ statusCode: 400, message: 'scheduledAt must be a valid date' })
  }

  const now = Date.now()
  if (when.getTime() < now + MIN_LEAD_MS) {
    throw createError({
      statusCode: 400,
      message: 'Schedule time must be at least one minute from now'
    })
  }

  const conn = await getTenantConnectionFromEvent(event)
  const dbName = conn.db?.databaseName
  if (!dbName) {
    throw createError({ statusCode: 500, message: 'Tenant connection has no database name' })
  }

  const { Campaign } = getTenantClientModels(conn)
  const campaign = await (Campaign as CampaignModel).findById(campaignId).lean<CampaignLean | null>()
  if (!campaign) throw createError({ statusCode: 404, message: 'Campaign not found' })
  if (campaign.status !== 'Draft') {
    throw createError({ statusCode: 400, message: 'Only draft campaigns can be scheduled' })
  }

  const snap = tenantUserFieldsFromAuth(event.context.auth)
  await (Campaign as CampaignModel).updateOne(
    { _id: campaignId },
    {
      $set: {
        status: 'Scheduled',
        scheduledAt: when,
        ...(snap ? { mergeUserSnapshot: snap } : {})
      }
    }
  )

  const delayMs = when.getTime() - now
  try {
    console.log('[ScheduleCampaign] enqueue', {
      campaignId,
      dbName,
      delayMs,
      scheduledAt: when.toISOString()
    })
    await enqueueScheduledCampaignStart(campaignId, dbName, delayMs)
  } catch (e: unknown) {
    await removeScheduledCampaignJob(dbName, campaignId)
    await (Campaign as CampaignModel).updateOne(
      { _id: campaignId },
      { $set: { status: 'Draft' }, $unset: { scheduledAt: 1 } }
    )
    console.error('[ScheduleCampaign] Failed to enqueue:', e)
    throw createError({ statusCode: 503, message: 'Failed to schedule send. Try again.' })
  }

  return {
    ok: true,
    campaignId,
    scheduledAt: when.toISOString()
  }
})
