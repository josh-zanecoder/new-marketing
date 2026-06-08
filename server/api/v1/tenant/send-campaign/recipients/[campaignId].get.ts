import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { CampaignLean, CampaignModel } from '@server/types/tenant/campaign.model'
import type { CampaignRecipientLean, CampaignRecipientModel } from '@server/types/tenant/campaignRecipient.model'
import {
  CAMPAIGN_RECIPIENT_STATUS_CANCELLED,
  CAMPAIGN_RECIPIENT_STATUS_FAILED,
  CAMPAIGN_RECIPIENT_STATUS_PENDING,
  CAMPAIGN_RECIPIENT_STATUS_SENDING,
  CAMPAIGN_RECIPIENT_STATUS_SENT
} from '@server/utils/campaignSend/constants'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { countCampaignRecipientStatuses } from '@server/utils/campaignSend/recipientStatusCounts'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'

type RecipientReportStatus = 'all' | 'sent' | 'pending' | 'failed' | 'cancelled'

function parseReportStatus(raw: string | undefined): RecipientReportStatus {
  const s = String(raw ?? 'all').trim().toLowerCase()
  if (s === 'sent' || s === 'pending' || s === 'failed' || s === 'cancelled') return s
  return 'all'
}

export default defineEventHandler(async (event) => {
  const campaignId = String(getRouterParam(event, 'campaignId') ?? '').trim()
  if (!campaignId) throw createError({ statusCode: 400, message: 'campaignId is required' })

  const query = getQuery(event)
  const status = parseReportStatus(query.status as string | undefined)
  const page = Math.max(1, Number(query.page ?? 1) || 1)
  const limit = Math.min(100, Math.max(1, Number(query.limit ?? 50) || 50))
  const search = String(query.search ?? '').trim().toLowerCase()

  const conn = await getTenantConnectionFromEvent(event)
  const { Campaign, CampaignRecipient } = getTenantClientModels(conn)

  const campaign = await (Campaign as CampaignModel)
    .findOne(mergeTenantOwnerEmailScopeFilter({ _id: campaignId }, event.context.auth))
    .select('_id status')
    .lean<Pick<CampaignLean, '_id' | 'status'> | null>()
  if (!campaign) throw createError({ statusCode: 404, message: 'Campaign not found' })

  const baseFilter: Record<string, unknown> = { campaign: campaignId }
  if (status === 'sent') {
    baseFilter.status = CAMPAIGN_RECIPIENT_STATUS_SENT
  } else if (status === 'failed') {
    baseFilter.status = CAMPAIGN_RECIPIENT_STATUS_FAILED
  } else if (status === 'pending') {
    baseFilter.status = { $in: [CAMPAIGN_RECIPIENT_STATUS_PENDING, CAMPAIGN_RECIPIENT_STATUS_SENDING] }
  } else if (status === 'cancelled') {
    baseFilter.status = CAMPAIGN_RECIPIENT_STATUS_CANCELLED
  }
  if (search) {
    baseFilter.email = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
  }

  const [items, total, statusCounts] = await Promise.all([
    (CampaignRecipient as CampaignRecipientModel)
      .find(baseFilter)
      .sort({ status: 1, email: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('email status sentAt error brevoLastEvent brevoLastEventAt')
      .lean<CampaignRecipientLean[]>(),
    (CampaignRecipient as CampaignRecipientModel).countDocuments(baseFilter),
    countCampaignRecipientStatuses(CampaignRecipient as CampaignRecipientModel, campaignId)
  ])

  const pending = statusCounts.pending + statusCounts.sending

  return {
    campaignId,
    campaignStatus: campaign.status,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    counts: {
      sent: statusCounts.sent,
      pending,
      failed: statusCounts.failed,
      sending: statusCounts.sending,
      cancelled: statusCounts.cancelled,
      total: statusCounts.sent + pending + statusCounts.failed + statusCounts.cancelled
    },
    items: items.map((r) => ({
      email: r.email,
      status: r.status,
      sentAt: r.sentAt ? new Date(r.sentAt).toISOString() : undefined,
      error: r.error,
      brevoLastEvent: r.brevoLastEvent || undefined,
      brevoLastEventAt: r.brevoLastEventAt
        ? new Date(r.brevoLastEventAt).toISOString()
        : undefined
    }))
  }
})
