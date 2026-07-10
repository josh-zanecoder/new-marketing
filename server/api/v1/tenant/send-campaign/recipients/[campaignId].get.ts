import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { CampaignLean, CampaignModel } from '@server/types/tenant/campaign.model'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'
import {
  buildCampaignRecipientReport,
  parseRecipientReportStatus
} from '@server/utils/campaignSend/campaignRecipientReport'

export default defineEventHandler(async (event) => {
  const campaignId = String(getRouterParam(event, 'campaignId') ?? '').trim()
  if (!campaignId) throw createError({ statusCode: 400, message: 'campaignId is required' })

  const query = getQuery(event)
  const status = parseRecipientReportStatus(query.status as string | undefined)
  const page = Math.max(1, Number(query.page ?? 1) || 1)
  const limit = Math.min(100, Math.max(1, Number(query.limit ?? 50) || 50))
  const search = String(query.search ?? '').trim().toLowerCase()

  const conn = await getTenantConnectionFromEvent(event)
  const { Campaign } = getTenantClientModels(conn)

  const campaign = await (Campaign as CampaignModel)
    .findOne(mergeTenantOwnerEmailScopeFilter({ _id: campaignId }, event.context.auth))
    .select('_id status recipientsType recipientsListId')
    .lean<Pick<CampaignLean, '_id' | 'status' | 'recipientsType' | 'recipientsListId'> | null>()
  if (!campaign) throw createError({ statusCode: 404, message: 'Campaign not found' })

  return buildCampaignRecipientReport(conn, campaign, { status, page, limit, search })
})
