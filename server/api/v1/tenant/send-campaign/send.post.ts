import { beginCampaignSend } from '@server/services/send-campaign.service'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { tenantUserFieldsFromAuth } from '@server/utils/emailMerge/tenantUserFromAuth'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ campaignId: string }>(event)
  const campaignId = body?.campaignId
  if (!campaignId) throw createError({ statusCode: 400, message: 'campaignId is required' })

  const conn = await getTenantConnectionFromEvent(event)
  const snap = tenantUserFieldsFromAuth(event.context.auth)

  return beginCampaignSend(conn, campaignId, {
    allowedStatuses: ['Draft'],
    ...(snap ? { mergeUserSnapshot: snap } : {})
  })
})
