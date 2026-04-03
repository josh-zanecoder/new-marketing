import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { removeScheduledCampaignJob } from '@server/queue/emailQueue'
import type { CampaignLean, CampaignModel } from '@server/types/tenant/campaign.model'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'

export default defineEventHandler(async (event) => {
  const campaignId = getRouterParam(event, 'campaignId')
  if (!campaignId) throw createError({ statusCode: 400, message: 'Campaign ID is required' })

  const conn = await getTenantConnectionFromEvent(event)
  const dbName = conn.db?.databaseName
  if (!dbName) {
    throw createError({ statusCode: 500, message: 'Tenant connection has no database name' })
  }

  const { Campaign } = getTenantClientModels(conn)
  const campaign = await (Campaign as CampaignModel).findById(campaignId).lean<CampaignLean | null>()
  if (!campaign) throw createError({ statusCode: 404, message: 'Campaign not found' })
  if (campaign.status !== 'Scheduled') {
    throw createError({ statusCode: 400, message: 'Only scheduled campaigns can be unscheduled' })
  }

  await removeScheduledCampaignJob(dbName, campaignId)
  await (Campaign as CampaignModel).updateOne(
    { _id: campaignId },
    { $set: { status: 'Draft' }, $unset: { scheduledAt: 1 } }
  )

  return { ok: true, campaignId }
})
