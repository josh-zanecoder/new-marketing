import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
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

  const { Campaign } = getTenantClientModels(conn)
  const campaign = await (Campaign as CampaignModel)
    .findOne(mergeTenantOwnerEmailScopeFilter({ _id: campaignId }, event.context.auth))
    .select('status')
    .lean<Pick<CampaignLean, 'status'> | null>()
  if (!campaign) throw createError({ statusCode: 404, message: 'Campaign not found' })

  const revertStatus =
    campaign.status === 'Paused'
      ? 'Paused'
      : campaign.status === 'Cancelled'
        ? 'Cancelled'
        : 'Failed'

  console.log('[SendCampaignAPI] sendAgain', { campaignId, dbName, revertStatus })

  return beginCampaignSend(conn, campaignId, {
    allowedStatuses: ['Paused', 'Failed', 'Cancelled'],
    mode: 'resend_all',
    auth: event.context.auth,
    statusOnEnqueueFailure: revertStatus,
    ...(snap ? { mergeUserSnapshot: snap } : {})
  })
})
