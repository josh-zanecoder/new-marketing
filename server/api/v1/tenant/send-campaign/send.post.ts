import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { removeScheduledCampaignJob } from '@server/queue/emailQueue'
import { beginCampaignSend } from '@server/services/send-campaign.service'
import type { CampaignLean, CampaignModel } from '@server/types/tenant/campaign.model'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'
import { tenantUserFieldsFromAuth } from '@server/utils/emailMerge/tenantUserFromAuth'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ campaignId: string }>(event)
  const campaignId = String(body?.campaignId ?? '').trim()
  if (!campaignId) throw createError({ statusCode: 400, message: 'campaignId is required' })

  const conn = await getTenantConnectionFromEvent(event)
  const snap = tenantUserFieldsFromAuth(event.context.auth)
  const dbName = conn.db?.databaseName
  if (!dbName) {
    throw createError({ statusCode: 500, message: 'Tenant connection has no database name' })
  }

  const { Campaign } = getTenantClientModels(conn)
  const campaignScope = mergeTenantOwnerEmailScopeFilter({ _id: campaignId }, event.context.auth)
  const campaign = await (Campaign as CampaignModel)
    .findOne(campaignScope)
    .select('_id status')
    .lean<CampaignLean | null>()
  if (!campaign) throw createError({ statusCode: 404, message: 'Campaign not found' })

  const isScheduledSend = campaign.status === 'Scheduled'
  if (isScheduledSend) {
    const removeResult = await removeScheduledCampaignJob(dbName, campaignId)
    if (!removeResult.removed && removeResult.reason === 'active') {
      throw createError({
        statusCode: 409,
        message: 'Scheduled send is starting now; wait a moment and try again.'
      })
    }
  }

  console.log('[SendCampaignAPI] sendNow', { campaignId, dbName, fromScheduled: isScheduledSend })

  return beginCampaignSend(conn, campaignId, {
    allowedStatuses: ['Draft', 'Scheduled'],
    auth: event.context.auth,
    ...(snap ? { mergeUserSnapshot: snap } : {})
  })
})
