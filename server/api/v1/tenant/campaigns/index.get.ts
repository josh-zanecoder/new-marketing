import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { CampaignLean, CampaignModel } from '@server/types/tenant/campaign.model'
import type { ManualRecipientModel } from '@server/types/tenant/manualRecipient.model'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'

/**
 * Lean campaign index — no recipient email arrays.
 * Full recipients load on GET /campaigns/:id (detail). List pages were lagging
 * because every row resolved ManualRecipient contacts + list membership emails.
 */
export default defineEventHandler(async (event) => {
  const conn = await getTenantConnectionFromEvent(event)
  const { Campaign, ManualRecipient } = getTenantClientModels(conn)

  const campaigns = await (Campaign as CampaignModel)
    .find(mergeTenantOwnerEmailScopeFilter({}, event.context.auth))
    .select(
      '_id name sender recipientsType recipientsListId subject status scheduledAt createdAt updatedAt'
    )
    .sort({ createdAt: -1 })
    .lean<CampaignLean[]>()

  const campaignIds = campaigns.map((c) => c._id)
  const manualCountByCampaign = new Map<string, number>()
  if (campaignIds.length > 0) {
    const counts = await (ManualRecipient as ManualRecipientModel).aggregate<{
      _id: unknown
      n: number
    }>([{ $match: { campaign: { $in: campaignIds } } }, { $group: { _id: '$campaign', n: { $sum: 1 } } }])
    for (const row of counts) {
      manualCountByCampaign.set(String(row._id), row.n)
    }
  }

  return {
    campaigns: campaigns.map((c) => {
      const id = String(c._id)
      const recipientsCount =
        c.recipientsType === 'manual' ? (manualCountByCampaign.get(id) ?? 0) : 0
      return {
        id,
        name: c.name,
        sender: c.sender,
        recipientsType: c.recipientsType,
        recipientsListId: c.recipientsListId,
        subject: c.subject,
        status: c.status,
        scheduledAt: c.scheduledAt ? new Date(c.scheduledAt).toISOString() : undefined,
        /** Empty on list — use detail endpoint for emails. */
        recipients: [] as { email: string; contactId?: string }[],
        recipientsCount,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt
      }
    })
  }
})
