import { isAdminAuthContext } from '@server/tenant/registry-auth'
import { listSendingCampaignsAcrossTenants } from '@server/services/cancelCampaignSend.service'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as unknown
  if (!isAdminAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const campaigns = await listSendingCampaignsAcrossTenants()
  return { campaigns, total: campaigns.length }
})
