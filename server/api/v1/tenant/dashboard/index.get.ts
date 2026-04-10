import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { CampaignLean, CampaignModel } from '@server/types/tenant/campaign.model'
import type { CampaignRecipientModel } from '@server/types/tenant/campaignRecipient.model'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'

export default defineEventHandler(async (event) => {
  const conn = await getTenantConnectionFromEvent(event)
  const auth = event.context.auth
  const { Campaign, CampaignRecipient, RecipientList, Contact } = getTenantClientModels(conn)

  const campaignFilter = mergeTenantOwnerEmailScopeFilter({}, auth)
  const listFilter = mergeTenantOwnerEmailScopeFilter({}, auth)
  const contactFilter = mergeTenantOwnerEmailScopeFilter({ deletedAt: null }, auth)

  const now = new Date()
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const endOfMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999)
  )

  const [recentRaw, statusAgg, campaignIds, listsCount, contactsCount] = await Promise.all([
    (Campaign as CampaignModel)
      .find(campaignFilter)
      .select('_id name subject status scheduledAt updatedAt')
      .sort({ updatedAt: -1 })
      .limit(8)
      .lean<CampaignLean[]>(),
    (Campaign as CampaignModel).aggregate<{ _id: string; count: number }>([
      { $match: campaignFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    (Campaign as CampaignModel).distinct('_id', campaignFilter),
    RecipientList.countDocuments(listFilter),
    Contact.countDocuments(contactFilter)
  ])

  const ids = (campaignIds as mongoose.Types.ObjectId[]).filter(Boolean)
  const statusBreakdown: Record<string, number> = {}
  let totalCampaigns = 0
  for (const row of statusAgg) {
    const key = String(row._id ?? '')
    statusBreakdown[key] = row.count
    totalCampaigns += row.count
  }

  let sentThisMonth = 0
  let recipientRowsSent = 0
  let recipientRowsFailed = 0
  let recipientRowsPending = 0

  if (ids.length) {
    const [monthCount, recipientAgg] = await Promise.all([
      (CampaignRecipient as CampaignRecipientModel).countDocuments({
        campaign: { $in: ids },
        status: 'sent',
        sentAt: { $gte: startOfMonth, $lte: endOfMonth }
      }),
      (CampaignRecipient as CampaignRecipientModel).aggregate<{ _id: string; count: number }>([
        { $match: { campaign: { $in: ids } } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ])
    ])
    sentThisMonth = monthCount
    for (const row of recipientAgg) {
      const k = String(row._id ?? '')
      if (k === 'sent') recipientRowsSent = row.count
      else if (k === 'failed') recipientRowsFailed = row.count
      else if (k === 'pending') recipientRowsPending = row.count
    }
  }

  const attempted = recipientRowsSent + recipientRowsFailed
  const deliveryRatePercent =
    attempted > 0 ? Math.round((recipientRowsSent / attempted) * 1000) / 10 : null

  const scheduledCampaigns = statusBreakdown.Scheduled ?? 0

  const recentCampaigns = recentRaw.map((c) => ({
    id: String(c._id),
    name: c.name,
    subject: c.subject ?? '',
    status: c.status,
    scheduledAt: c.scheduledAt ? new Date(c.scheduledAt).toISOString() : undefined,
    updatedAt: c.updatedAt ? new Date(c.updatedAt).toISOString() : new Date().toISOString()
  }))

  return {
    stats: {
      totalCampaigns,
      sentThisMonth,
      scheduledCampaigns,
      recipientLists: listsCount,
      contacts: contactsCount,
      deliveryRatePercent,
      emailsDeliveredTotal: recipientRowsSent,
      emailsFailedTotal: recipientRowsFailed,
      emailsPendingTotal: recipientRowsPending
    },
    statusBreakdown,
    recentCampaigns
  }
})
