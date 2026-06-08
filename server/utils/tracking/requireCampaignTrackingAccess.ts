import type { H3Event } from 'h3'
import type { TenantClientModels } from '@server/models/tenant/tenantClientModels'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { isRegisteredTenantAuthContext } from '@server/tenant/registry-auth'
import type { CampaignModel } from '@server/types/tenant/campaign.model'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'
import { parseCampaignIdQuery } from './parseCampaignIdQuery'

export async function requireCampaignTrackingAccess(
  event: H3Event
): Promise<{ models: TenantClientModels; campaignId: string }> {
  const auth = event.context.auth
  if (!isRegisteredTenantAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Tenant session required' })
  }

  const campaignId = parseCampaignIdQuery(event)
  if (!campaignId) {
    throw createError({ statusCode: 400, message: 'Valid campaignId is required' })
  }

  const conn = await getTenantConnectionFromEvent(event)
  const models = getTenantClientModels(conn)
  const campaign = await (models.Campaign as CampaignModel)
    .findOne(mergeTenantOwnerEmailScopeFilter({ _id: campaignId }, auth))
    .select('_id')
    .lean()
  if (!campaign) {
    throw createError({ statusCode: 404, message: 'Campaign not found' })
  }

  return { models, campaignId }
}
