import type { Connection } from 'mongoose'
import type { CampaignLean } from '@server/types/tenant/campaign.model'
import type { CampaignRecipientLean, CampaignRecipientModel } from '@server/types/tenant/campaignRecipient.model'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import {
  CAMPAIGN_RECIPIENT_ABORTED_STATUSES,
  CAMPAIGN_RECIPIENT_STATUS_FAILED,
  CAMPAIGN_RECIPIENT_STATUS_PENDING,
  CAMPAIGN_RECIPIENT_STATUS_SENDING,
  CAMPAIGN_RECIPIENT_STATUS_SENT
} from '@server/utils/campaignSend/constants'
import { resolvePlannedCampaignRecipientEmails } from '@server/utils/campaignSend/plannedCampaignRecipients'

export type RecipientReportStatus = 'all' | 'sent' | 'pending' | 'failed' | 'aborted'

export function parseRecipientReportStatus(raw: string | undefined): RecipientReportStatus {
  const s = String(raw ?? 'all').trim().toLowerCase()
  if (s === 'sent' || s === 'pending' || s === 'failed' || s === 'aborted' || s === 'cancelled') {
    return s === 'cancelled' ? 'aborted' : s
  }
  return 'all'
}

type ReportQuery = {
  status: RecipientReportStatus
  page: number
  limit: number
  search: string
}

export async function buildCampaignRecipientReport(
  conn: Connection,
  campaign: Pick<CampaignLean, '_id' | 'status' | 'recipientsType' | 'recipientsListId'>,
  query: ReportQuery
) {
  const campaignId = String(campaign._id)
  const { status, page, limit, search } = query
  const { CampaignRecipient } = getTenantClientModels(conn)

  const baseFilter: Record<string, unknown> = { campaign: campaignId }
  if (status === 'sent') {
    baseFilter.status = CAMPAIGN_RECIPIENT_STATUS_SENT
  } else if (status === 'failed') {
    baseFilter.status = CAMPAIGN_RECIPIENT_STATUS_FAILED
  } else if (status === 'pending') {
    baseFilter.status = { $in: [CAMPAIGN_RECIPIENT_STATUS_PENDING, CAMPAIGN_RECIPIENT_STATUS_SENDING] }
  } else if (status === 'aborted') {
    baseFilter.status = { $in: [...CAMPAIGN_RECIPIENT_ABORTED_STATUSES] }
  }
  if (search) {
    baseFilter.email = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
  }

  const [items, total, sent, pending, failed, sending, aborted] = await Promise.all([
    (CampaignRecipient as CampaignRecipientModel)
      .find(baseFilter)
      .sort({ status: 1, email: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('email status sentAt error')
      .lean<CampaignRecipientLean[]>(),
    (CampaignRecipient as CampaignRecipientModel).countDocuments(baseFilter),
    (CampaignRecipient as CampaignRecipientModel).countDocuments({
      campaign: campaignId,
      status: CAMPAIGN_RECIPIENT_STATUS_SENT
    }),
    (CampaignRecipient as CampaignRecipientModel).countDocuments({
      campaign: campaignId,
      status: { $in: [CAMPAIGN_RECIPIENT_STATUS_PENDING, CAMPAIGN_RECIPIENT_STATUS_SENDING] }
    }),
    (CampaignRecipient as CampaignRecipientModel).countDocuments({
      campaign: campaignId,
      status: CAMPAIGN_RECIPIENT_STATUS_FAILED
    }),
    (CampaignRecipient as CampaignRecipientModel).countDocuments({
      campaign: campaignId,
      status: CAMPAIGN_RECIPIENT_STATUS_SENDING
    }),
    (CampaignRecipient as CampaignRecipientModel).countDocuments({
      campaign: campaignId,
      status: { $in: [...CAMPAIGN_RECIPIENT_ABORTED_STATUSES] }
    })
  ])

  const materializedTotal = sent + pending + failed + aborted
  if (materializedTotal === 0 && campaign.status === 'Scheduled') {
    let planned = await resolvePlannedCampaignRecipientEmails(conn, campaign)
    if (search) {
      planned = planned.filter((email) => email.toLowerCase().includes(search))
    }
    if (status === 'sent' || status === 'failed' || status === 'aborted') {
      planned = []
    }
    const totalPlanned = planned.length
    const start = (page - 1) * limit
    const pageEmails = planned.slice(start, start + limit)
    return {
      campaignId,
      campaignStatus: campaign.status,
      page,
      limit,
      total: totalPlanned,
      totalPages: Math.max(1, Math.ceil(totalPlanned / limit)),
      counts: {
        sent: 0,
        pending: totalPlanned,
        failed: 0,
        sending: 0,
        aborted: 0,
        total: totalPlanned
      },
      items: pageEmails.map((email) => ({
        email,
        status: 'pending' as const
      }))
    }
  }

  return {
    campaignId,
    campaignStatus: campaign.status,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    counts: {
      sent,
      pending,
      failed,
      sending,
      aborted,
      total: materializedTotal
    },
    items: items.map((r) => ({
      email: r.email,
      status: r.status,
      sentAt: r.sentAt ? new Date(r.sentAt).toISOString() : undefined,
      error: r.error
    }))
  }
}
