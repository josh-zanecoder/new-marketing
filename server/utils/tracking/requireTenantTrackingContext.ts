import type { H3Event } from 'h3'
import type { TenantClientModels } from '@server/models/tenant/tenantClientModels'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import {
  isRegisteredTenantAuthContext,
  type RegisteredTenantAuthContext
} from '@server/tenant/registry-auth'
import type { CampaignModel } from '@server/types/tenant/campaign.model'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'
import { parseCampaignIdQuery } from './parseCampaignIdQuery'

export async function requireTenantTrackingContext(event: H3Event): Promise<{
  models: TenantClientModels
  auth: RegisteredTenantAuthContext
  campaignFilter: Record<string, unknown>
  campaignId: string | null
}> {
  const auth = event.context.auth
  if (!auth || typeof auth !== 'object') {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  if (!isRegisteredTenantAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Tenant session required for tracking' })
  }

  const dbName = auth.dbName.trim()
  if (!dbName) {
    throw createError({ statusCode: 403, message: 'Missing tenant database context' })
  }

  const conn = await getTenantConnectionFromEvent(event)
  const models = getTenantClientModels(conn)
  const campaignFilter = mergeTenantOwnerEmailScopeFilter({}, auth)
  const campaignId = parseCampaignIdQuery(event)

  if (campaignId) {
    const campaign = await (models.Campaign as CampaignModel)
      .findOne(mergeTenantOwnerEmailScopeFilter({ _id: campaignId }, auth))
      .select('_id')
      .lean()
    if (!campaign) {
      throw createError({ statusCode: 404, message: 'Campaign not found' })
    }
  }

  return { models, auth, campaignFilter, campaignId }
}
