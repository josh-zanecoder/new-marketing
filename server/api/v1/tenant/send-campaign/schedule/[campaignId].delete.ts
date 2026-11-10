import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { removeScheduledCampaignJob } from '@server/queue/emailQueue'
import type { CampaignLean, CampaignModel } from '@server/types/tenant/campaign.model'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'
import { decideCampaignUnschedule } from '~~/shared/campaignUnscheduleEligibility'

export default defineEventHandler(async (event) => {
  const campaignId = String(getRouterParam(event, 'campaignId') ?? '').trim()
  if (!campaignId) throw createError({ statusCode: 400, message: 'Campaign ID is required' })
  if (!mongoose.isValidObjectId(campaignId)) {
    throw createError({ statusCode: 400, message: 'Campaign ID is invalid' })
  }

  const conn = await getTenantConnectionFromEvent(event)
  const dbName = conn.db?.databaseName
  if (!dbName) {
    throw createError({ statusCode: 500, message: 'Tenant connection has no database name' })
  }

  const { Campaign } = getTenantClientModels(conn)
  const campaignScope = mergeTenantOwnerEmailScopeFilter(
    { _id: new mongoose.Types.ObjectId(campaignId) },
    event.context.auth
  )
  const campaign = await (Campaign as CampaignModel)
    .findOne(campaignScope)
    .select('_id status scheduledAt')
    .lean<CampaignLean | null>()
  if (!campaign) throw createError({ statusCode: 404, message: 'Campaign not found' })

  const decision = decideCampaignUnschedule({
    status: campaign.status,
    scheduledAt: campaign.scheduledAt
  })

  if (decision.action === 'reject') {
    console.warn('[UnscheduleCampaign] rejected', {
      campaignId,
      status: campaign.status,
      hasScheduledAt: !!campaign.scheduledAt
    })
    throw createError({ statusCode: 400, message: decision.message })
  }

  if (decision.action === 'already_cancelled') {
    return { ok: true, campaignId, alreadyCancelled: true }
  }

  const removeResult = await removeScheduledCampaignJob(dbName, campaignId)
  if (!removeResult.removed && removeResult.reason === 'active') {
    throw createError({
      statusCode: 409,
      message: 'Scheduled send is starting now; wait a moment and try again.'
    })
  }

  await (Campaign as CampaignModel).updateOne(campaignScope, {
    $set: { status: 'Draft' },
    $unset: { scheduledAt: 1 }
  })

  return { ok: true, campaignId, alreadyCancelled: false }
})
