import { getTenantClientModels } from '../../../models/tenant/tenantClientModels'
import type { CampaignLean, CampaignModel } from '../../../types/tenant/campaign.model'
import type { ManualRecipientLean, ManualRecipientModel } from '../../../types/tenant/manualRecipient.model'
import { getTenantConnectionFromEvent } from '../../../tenant/connection'

export default defineEventHandler(async (event) => {
  const conn = await getTenantConnectionFromEvent(event)
  const { Campaign, ManualRecipient } = getTenantClientModels(conn)

  const campaigns = await (Campaign as CampaignModel)
    .find({})
    .sort({ createdAt: -1 })
    .lean<CampaignLean[]>()
  const campaignIds = campaigns.map((c) => c._id)

  const recipientDocs = await (ManualRecipient as ManualRecipientModel)
    .find({ campaign: { $in: campaignIds } })
    .lean<ManualRecipientLean[]>()
  const recipientsByCampaign = new Map<string, { email: string }[]>()
  for (const r of recipientDocs) {
    const id = String(r.campaign)
    if (!recipientsByCampaign.has(id)) recipientsByCampaign.set(id, [])
    recipientsByCampaign.get(id)!.push({ email: r.email })
  }

  const campaignsWithRecipients = campaigns.map((c) => {
    const id = String(c._id)
    const recipients = c.recipientsType === 'manual' ? (recipientsByCampaign.get(id) || []) : []
    return {
      id,
      name: c.name,
      sender: c.sender,
      recipientsType: c.recipientsType,
      recipientsListId: c.recipientsListId,
      subject: c.subject,
      status: c.status,
      recipients,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt
    }
  })

  return { campaigns: campaignsWithRecipients }
})
