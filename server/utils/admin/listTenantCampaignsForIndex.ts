import type { Connection } from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { CampaignLean, CampaignModel } from '@server/types/tenant/campaign.model'
import type { ManualRecipientModel } from '@server/types/tenant/manualRecipient.model'

export type TenantCampaignIndexRow = {
  id: string
  name: string
  sender: CampaignLean['sender']
  recipientsType: CampaignLean['recipientsType']
  recipientsListId?: string
  subject: string
  status: string
  scheduledAt?: string
  /** Always empty on list — load detail for emails. */
  recipients: { email: string; contactId?: string }[]
  /** Manual recipient row count (for send gating). List-type uses recipientsListId. */
  recipientsCount: number
  createdAt: string
  updatedAt: string
  /** Lowercased email of the user who owns the campaign. */
  ownerEmail?: string
  /** Creator id, or email when the session had no user id. */
  createdBy?: string
  /** Name and email captured when the campaign was created. */
  creator?: {
    firstName?: string
    lastName?: string
    email?: string
  }
}

/**
 * Lean campaign index for one tenant — same shape as GET `/api/v1/tenant/campaigns`.
 * Does not resolve recipient emails (that made the campaigns page laggy).
 */
export async function listTenantCampaignsForIndex(
  conn: Connection
): Promise<TenantCampaignIndexRow[]> {
  const { Campaign, ManualRecipient } = getTenantClientModels(conn)

  const campaigns = await (Campaign as CampaignModel)
    .find({})
    .select(
      '_id name sender recipientsType recipientsListId subject status scheduledAt createdAt updatedAt metadata createdBy mergeUserSnapshot'
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

  return campaigns.map((c) => {
    const id = String(c._id)
    const recipientsCount =
      c.recipientsType === 'manual' ? (manualCountByCampaign.get(id) ?? 0) : 0
    const snap = c.mergeUserSnapshot
    const creator = snap
      ? {
          firstName: snap.firstName?.trim() || undefined,
          lastName: snap.lastName?.trim() || undefined,
          email: snap.email?.trim() || undefined
        }
      : undefined
    const hasCreator = !!(creator?.firstName || creator?.lastName || creator?.email)
    return {
      id,
      name: c.name,
      sender: c.sender,
      recipientsType: c.recipientsType,
      recipientsListId: c.recipientsListId,
      subject: c.subject,
      status: c.status,
      scheduledAt: c.scheduledAt ? new Date(c.scheduledAt).toISOString() : undefined,
      recipients: [],
      recipientsCount,
      createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : '',
      updatedAt: c.updatedAt ? new Date(c.updatedAt).toISOString() : '',
      ownerEmail: c.metadata?.ownerEmail?.trim() || undefined,
      createdBy: c.createdBy?.trim() || undefined,
      creator: hasCreator ? creator : undefined
    }
  })
}
