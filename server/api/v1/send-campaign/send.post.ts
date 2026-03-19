import type { Model } from 'mongoose'
import { Campaign } from '../../../models/Campaign'
import { CampaignRecipient } from '../../../models/CampaignRecipient'
import { ManualRecipient } from '../../../models/ManualRecipients'
import { getRegistryConnection } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ campaignId: string }>(event)
  const campaignId = body?.campaignId
  if (!campaignId) throw createError({ statusCode: 400, message: 'campaignId is required' })

  await getRegistryConnection()

  const campaign = await (Campaign as Model<any>).findById(campaignId).lean() as any
  if (!campaign) throw createError({ statusCode: 404, message: 'Campaign not found' })
  if (campaign.status !== 'Draft') {
    throw createError({ statusCode: 400, message: 'Campaign can only be sent when in Draft status' })
  }

  const existing = await (CampaignRecipient as Model<any>).countDocuments({ campaign: campaignId })
  if (existing > 0) {
    throw createError({ statusCode: 400, message: 'Campaign has already been queued for sending' })
  }

  let emails: string[] = []
  if (campaign.recipientsType === 'manual') {
    const docs = await (ManualRecipient as Model<any>).find({ campaign: campaignId }).lean() as any[]
    emails = docs.map((r) => r.email)
  }
  if (!emails.length) throw createError({ statusCode: 400, message: 'No recipients to send to' })

  await (CampaignRecipient as Model<any>).insertMany(
    emails.map((email) => ({ campaign: campaignId, email, status: 'pending', clientId: '' })) as any
  )

  await (Campaign as Model<any>).updateOne({ _id: campaignId }, { status: 'Sending' })

  return { ok: true, total: emails.length }
})
