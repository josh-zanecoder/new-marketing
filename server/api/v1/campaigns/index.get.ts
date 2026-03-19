import type { Model } from 'mongoose'
import { Campaign } from '../../../models/Campaign'
import { ManualRecipient } from '../../../models/ManualRecipients'
import { getRegistryConnection } from '../../../utils/db'

export default defineEventHandler(async () => {
  await getRegistryConnection()

  const campaigns = await (Campaign as Model<any>).find({}).sort({ createdAt: -1 }).lean()
  const campaignIds = campaigns.map((c) => c._id)

  const recipientDocs = await (ManualRecipient as Model<any>).find({ campaign: { $in: campaignIds } }).lean()
  const recipientsByCampaign = new Map<string, { email: string }[]>()
  for (const r of recipientDocs as unknown as { campaign: unknown; email: string }[]) {
    const id = String(r.campaign)
    if (!recipientsByCampaign.has(id)) recipientsByCampaign.set(id, [])
    recipientsByCampaign.get(id)!.push({ email: r.email })
  }

  const campaignsWithRecipients = (campaigns as unknown as { _id: unknown; name: string; sender: object; recipientsType: string; recipientsListId: string; subject: string; status: string; createdAt: unknown; updatedAt: unknown }[]).map((c) => {
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
