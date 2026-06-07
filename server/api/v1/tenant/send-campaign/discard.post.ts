import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { discardPausedCampaignSend } from '@server/services/cancelCampaignSend.service'
import type { CampaignLean, CampaignModel } from '@server/types/tenant/campaign.model'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'

export default defineEventHandler(async (event) => {
  const body = (await readBody(event).catch(() => ({}))) as {
    campaignId?: string
    confirm?: boolean
  }
  const campaignId = String(body?.campaignId ?? '').trim()
  if (!campaignId) throw createError({ statusCode: 400, message: 'campaignId is required' })
  if (body.confirm !== true) {
    throw createError({
      statusCode: 400,
      message: 'Set confirm: true to cancel this paused send permanently'
    })
  }

  const conn = await getTenantConnectionFromEvent(event)
  const dbName = String(conn.db?.databaseName ?? '').trim()
  if (!dbName) throw createError({ statusCode: 500, message: 'Tenant database unavailable' })

  const auth = event.context.auth
  const tenantName =
    auth && typeof auth === 'object' && 'tenantName' in auth && typeof auth.tenantName === 'string'
      ? auth.tenantName
      : dbName

  const { Campaign } = getTenantClientModels(conn)
  const owned = await (Campaign as CampaignModel)
    .findOne(mergeTenantOwnerEmailScopeFilter({ _id: campaignId }, auth))
    .select('_id status')
    .lean<Pick<CampaignLean, 'status'> | null>()
  if (!owned) throw createError({ statusCode: 404, message: 'Campaign not found' })

  const models = getTenantClientModels(conn)
  return discardPausedCampaignSend(models, campaignId, { tenantDbName: dbName, tenantName })
})
