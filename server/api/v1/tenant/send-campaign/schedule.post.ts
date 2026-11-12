import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import {
  enqueueScheduledCampaignStart,
  removeScheduledCampaignJob
} from '@server/queue/emailQueue'
import type { CampaignLean, CampaignModel } from '@server/types/tenant/campaign.model'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'
import { tenantUserFieldsFromAuth } from '@server/utils/emailMerge/tenantUserFromAuth'
import { assertCampaignEmailTemplateApprovedForSend } from '@server/utils/emailTemplate/assertCampaignEmailTemplateApprovedForSend'
import {
  CAMPAIGN_SCHEDULE_ERROR_STATUS,
  isCampaignScheduleableStatus,
  parseAndValidateCampaignScheduleAt
} from '~~/shared/campaignScheduleTime'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ campaignId: string; scheduledAt: string }>(event)
  const campaignId = String(body?.campaignId ?? '').trim()
  const scheduledAtRaw = String(body?.scheduledAt ?? '').trim()
  if (!campaignId) throw createError({ statusCode: 400, message: 'campaignId is required' })

  const parsed = parseAndValidateCampaignScheduleAt(scheduledAtRaw)
  if (!parsed.ok) {
    throw createError({ statusCode: 400, message: parsed.message })
  }
  const when = parsed.when
  const now = Date.now()

  const conn = await getTenantConnectionFromEvent(event)
  const dbName = conn.db?.databaseName
  if (!dbName) {
    throw createError({ statusCode: 500, message: 'Tenant connection has no database name' })
  }

  const { Campaign } = getTenantClientModels(conn)
  const campaignScope = mergeTenantOwnerEmailScopeFilter({ _id: campaignId }, event.context.auth)
  const campaign = await (Campaign as CampaignModel)
    .findOne(campaignScope)
    .select('_id status emailTemplate scheduledAt')
    .lean<CampaignLean | null>()
  if (!campaign) throw createError({ statusCode: 404, message: 'Campaign not found' })
  if (!isCampaignScheduleableStatus(String(campaign.status))) {
    throw createError({ statusCode: 400, message: CAMPAIGN_SCHEDULE_ERROR_STATUS })
  }

  await assertCampaignEmailTemplateApprovedForSend({
    conn,
    campaignId,
    auth: event.context.auth,
    campaign
  })

  const isReschedule = campaign.status === 'Scheduled'
  const previousScheduledAt = campaign.scheduledAt
    ? new Date(campaign.scheduledAt)
    : undefined

  const snap = tenantUserFieldsFromAuth(event.context.auth)
  const updateResult = await (Campaign as CampaignModel).updateOne(campaignScope, {
    $set: {
      status: 'Scheduled',
      scheduledAt: when,
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
      reschedule: isReschedule
    })
    await enqueueScheduledCampaignStart(campaignId, dbName, delayMs)
  } catch (e: unknown) {
    console.error('[ScheduleCampaign] Failed to enqueue:', e)
    if (isReschedule && previousScheduledAt && !Number.isNaN(previousScheduledAt.getTime())) {
      const restoreDelay = previousScheduledAt.getTime() - Date.now()
      try {
        await (Campaign as CampaignModel).updateOne(campaignScope, {
          $set: { status: 'Scheduled', scheduledAt: previousScheduledAt }
        })
      } catch (restoreDbErr: unknown) {
        console.error('[ScheduleCampaign] Failed to restore previous scheduledAt:', restoreDbErr)
      }
      try {
        if (restoreDelay >= 0) {
          await enqueueScheduledCampaignStart(campaignId, dbName, restoreDelay)
        } else {
          await enqueueScheduledCampaignStart(campaignId, dbName, 0)
        }
      } catch (restoreErr: unknown) {
        console.error('[ScheduleCampaign] Failed to restore previous schedule:', restoreErr)
        try {
          await removeScheduledCampaignJob(dbName, campaignId)
        } catch (cleanupErr: unknown) {
          console.error('[ScheduleCampaign] Cleanup after restore failure failed:', cleanupErr)
        }
        try {
          await (Campaign as CampaignModel).updateOne(
            mergeTenantOwnerEmailScopeFilter({ _id: campaignId }, event.context.auth),
            { $set: { status: 'Draft' }, $unset: { scheduledAt: 1 } }
          )
        } catch (revertErr: unknown) {
          console.error('[ScheduleCampaign] Revert to Draft after restore failure failed:', revertErr)
        }
      }
    } else {
      try {
        await removeScheduledCampaignJob(dbName, campaignId)
      } catch (cleanupErr: unknown) {
        console.error('[ScheduleCampaign] Cleanup after enqueue failure failed:', cleanupErr)
      }
      try {
        await (Campaign as CampaignModel).updateOne(
          mergeTenantOwnerEmailScopeFilter({ _id: campaignId }, event.context.auth),
          { $set: { status: 'Draft' }, $unset: { scheduledAt: 1 } }
        )
      } catch (revertErr: unknown) {
        console.error('[ScheduleCampaign] Revert to Draft after enqueue failure failed:', revertErr)
      }
    }
    throw createError({
      statusCode: 503,
      message: isReschedule
        ? 'Failed to reschedule send. Try again.'
        : 'Failed to schedule send. Try again.'
    })
  }

  return {
    ok: true,
    campaignId,
    scheduledAt: when.toISOString(),
    rescheduled: isReschedule
  }
})
