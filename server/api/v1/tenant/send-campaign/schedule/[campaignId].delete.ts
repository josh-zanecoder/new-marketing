import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { removeScheduledCampaignJob } from '@server/queue/emailQueue'
import { resolveCampaignStatusAfterScheduleCancel } from '@server/services/send-campaign.service'
import type { CampaignLean, CampaignModel } from '@server/types/tenant/campaign.model'
import type { CampaignRecipientModel } from '@server/types/tenant/campaignRecipient.model'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'

export default defineEventHandler(async (event) => {
  const campaignId = String(getRouterParam(event, 'campaignId') ?? '').trim()
  if (!campaignId) throw createError({ statusCode: 400, message: 'Campaign ID is required' })

  const conn = await getTenantConnectionFromEvent(event)
  const dbName = conn.db?.databaseName
  if (!dbName) {
    throw createError({ statusCode: 500, message: 'Tenant connection has no database name' })
  }

  const { Campaign, CampaignRecipient } = getTenantClientModels(conn)
  const campaignScope = mergeTenantOwnerEmailScopeFilter({ _id: campaignId }, event.context.auth)
  const campaign = await (Campaign as CampaignModel)
    .findOne(campaignScope)
    .select('_id status scheduledSendMode')
    .lean<Pick<CampaignLean, 'status' | 'scheduledSendMode'> | null>()
  if (!campaign) throw createError({ statusCode: 404, message: 'Campaign not found' })
  if (campaign.status !== 'Scheduled') {
    throw createError({ statusCode: 400, message: 'Only scheduled campaigns can be unscheduled' })
  }

  const removeResult = await removeScheduledCampaignJob(dbName, campaignId)
  if (!removeResult.removed && removeResult.reason === 'active') {
    throw createError({
      statusCode: 409,
      message: 'Scheduled send is starting now; wait a moment and try again.'
    })
  }

  const revertStatus = await resolveCampaignStatusAfterScheduleCancel(
    CampaignRecipient as CampaignRecipientModel,
    campaignId,
    campaign.scheduledSendMode
  )

  await (Campaign as CampaignModel).updateOne(campaignScope, {
    $set: { status: revertStatus },
    $unset: { scheduledAt: 1, scheduledSendMode: 1 }
  })

  return { ok: true, campaignId }
})
