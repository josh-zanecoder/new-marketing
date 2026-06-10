import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { CampaignLean, CampaignModel } from '@server/types/tenant/campaign.model'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'
import { resolveCampaignAudienceSummariesBatch } from '@server/utils/campaign/resolveCampaignAudienceCounts'

function campaignKey(raw: string): string {
  const trimmed = String(raw ?? '').trim()
  return trimmed && mongoose.isValidObjectId(trimmed)
    ? String(new mongoose.Types.ObjectId(trimmed))
    : trimmed
}

export default defineEventHandler(async (event) => {
  const conn = await getTenantConnectionFromEvent(event)
  const { Campaign } = getTenantClientModels(conn)

  const campaigns = await (Campaign as CampaignModel)
    .find(mergeTenantOwnerEmailScopeFilter({}, event.context.auth))
    .select(
      '_id name sender recipientsType recipientsListId subject status scheduledAt createdAt updatedAt'
    )
    .sort({ createdAt: -1 })
    .lean<CampaignLean[]>()

  const audienceByCampaign = await resolveCampaignAudienceSummariesBatch(conn, campaigns)

  const campaignsWithCounts = campaigns.map((c) => {
    const id = campaignKey(String(c._id))
    const audience = audienceByCampaign.get(id) ?? { recipientCount: 0 }

    return {
      id,
      name: c.name,
      sender: c.sender,
      recipientsType: c.recipientsType,
      recipientsListId: c.recipientsListId,
      subject: c.subject,
      status: c.status,
      scheduledAt: c.scheduledAt ? new Date(c.scheduledAt).toISOString() : undefined,
      recipientCount: audience.recipientCount,
      recipients: [] as { email: string; contactId?: string }[],
      createdAt: c.createdAt,
      updatedAt: c.updatedAt
    }
  })

  return { campaigns: campaignsWithCounts }
})
