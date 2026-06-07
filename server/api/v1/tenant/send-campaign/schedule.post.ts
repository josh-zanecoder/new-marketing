import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import {
  enqueueScheduledCampaignStart,
  removeScheduledCampaignJob
} from '@server/queue/emailQueue'
import { countUnsentRecipientsForResume } from '@server/services/send-campaign.service'
import type { CampaignLean, CampaignModel } from '@server/types/tenant/campaign.model'
import type { CampaignRecipientModel } from '@server/types/tenant/campaignRecipient.model'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'
import { tenantUserFieldsFromAuth } from '@server/utils/emailMerge/tenantUserFromAuth'

const MIN_LEAD_MS = 60_000

type ScheduleSendMode = 'new' | 'resume' | 'resend_all'

function parseScheduleMode(raw: string | undefined): ScheduleSendMode {
  if (raw === 'resume') return 'resume'
  if (raw === 'resend_all') return 'resend_all'
  return 'new'
}

const RESUME_SCHEDULE_STATUSES = ['Paused', 'Failed', 'Cancelled'] as const
const RESEND_ALL_SCHEDULE_STATUSES = ['Cancelled', 'Failed'] as const

export default defineEventHandler(async (event) => {
  const body = await readBody<{ campaignId: string; scheduledAt: string; mode?: string }>(event)
  const campaignId = String(body?.campaignId ?? '').trim()
  const scheduledAtRaw = String(body?.scheduledAt ?? '').trim()
  const scheduleMode = parseScheduleMode(body?.mode)
  if (!campaignId) throw createError({ statusCode: 400, message: 'campaignId is required' })
  if (!scheduledAtRaw) {
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

  const { Campaign, CampaignRecipient } = getTenantClientModels(conn)
  const campaignScope = mergeTenantOwnerEmailScopeFilter({ _id: campaignId }, event.context.auth)
  const campaign = await (Campaign as CampaignModel)
    .findOne(campaignScope)
    .select('_id status')
    .lean<CampaignLean | null>()
  if (!campaign) throw createError({ statusCode: 404, message: 'Campaign not found' })

  if (scheduleMode === 'new') {
    if (campaign.status !== 'Draft') {
      throw createError({
        statusCode: 400,
        message: 'Only draft campaigns can be scheduled to send to the full audience'
      })
    }
  } else if (scheduleMode === 'resume') {
    if (!RESUME_SCHEDULE_STATUSES.includes(campaign.status as (typeof RESUME_SCHEDULE_STATUSES)[number])) {
      throw createError({
        statusCode: 400,
        message: 'Only paused or partially completed campaigns can be scheduled to resume'
      })
    }
    const unsent = await countUnsentRecipientsForResume(
      CampaignRecipient as CampaignRecipientModel,
      campaignId
    )
    if (unsent === 0) {
      throw createError({
        statusCode: 400,
        message: 'No unsent recipients to schedule a resume send'
      })
    }
  } else if (
    !RESEND_ALL_SCHEDULE_STATUSES.includes(campaign.status as (typeof RESEND_ALL_SCHEDULE_STATUSES)[number])
  ) {
    throw createError({
      statusCode: 400,
      message: 'Only cancelled or completed campaigns can be scheduled to send again'
    })
  }

  const revertStatus = campaign.status

  const snap = tenantUserFieldsFromAuth(event.context.auth)
  const updateResult = await (Campaign as CampaignModel).updateOne(campaignScope, {
    $set: {
      status: 'Scheduled',
      scheduledAt: when,
      scheduledSendMode: scheduleMode,
      ...(snap ? { mergeUserSnapshot: snap } : {})
    }
  })
  if (updateResult.matchedCount === 0) {
    throw createError({ statusCode: 404, message: 'Campaign not found' })
  }

  const delayMs = when.getTime() - now
  try {
    console.log('[ScheduleCampaign] enqueue', {
      campaignId,
      dbName,
      delayMs,
      scheduledAt: when.toISOString(),
      mode: scheduleMode
    })
    await enqueueScheduledCampaignStart(campaignId, dbName, delayMs)
  } catch (e: unknown) {
    await removeScheduledCampaignJob(dbName, campaignId)
    await (Campaign as CampaignModel).updateOne(
      mergeTenantOwnerEmailScopeFilter({ _id: campaignId }, event.context.auth),
      { $set: { status: revertStatus }, $unset: { scheduledAt: 1, scheduledSendMode: 1 } }
    )
    console.error('[ScheduleCampaign] Failed to enqueue:', e)
    throw createError({ statusCode: 503, message: 'Failed to schedule send. Try again.' })
  }

  return {
    ok: true,
    campaignId,
    scheduledAt: when.toISOString(),
    mode: scheduleMode
  }
})
