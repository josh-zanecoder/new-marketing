import type { Model } from 'mongoose'
import { Campaign } from '../../../../models/Campaign'
import { CampaignRecipient } from '../../../../models/CampaignRecipient'
import { getRegistryConnection } from '../../../../utils/db'

const BATCH_SIZE = 2

export default defineEventHandler(async (event) => {
  const campaignId = getRouterParam(event, 'campaignId')
  if (!campaignId) throw createError({ statusCode: 400, message: 'campaignId is required' })

  await getRegistryConnection()

  const campaign = await (Campaign as Model<any>).findById(campaignId).lean() as any
  if (!campaign) throw createError({ statusCode: 404, message: 'Campaign not found' })

  const pending = await (CampaignRecipient as Model<any>).find({ campaign: campaignId, status: 'pending' }).limit(BATCH_SIZE).lean() as any[]

  for (const r of pending) {
    const isSent = Math.random() > 0.2
    if (isSent) {
      await (CampaignRecipient as Model<any>).updateOne(
        { _id: r._id },
        { status: 'sent', sentAt: new Date() }
      )
    } else {
      await (CampaignRecipient as Model<any>).updateOne(
        { _id: r._id },
        { status: 'failed', error: 'Simulated failure' }
      )
    }
  }

  const [pendingCount, sentCount, failedCount] = await Promise.all([
    (CampaignRecipient as Model<any>).countDocuments({ campaign: campaignId, status: 'pending' }),
    (CampaignRecipient as Model<any>).countDocuments({ campaign: campaignId, status: 'sent' }),
    (CampaignRecipient as Model<any>).countDocuments({ campaign: campaignId, status: 'failed' })
  ])

  if (pendingCount === 0) {
    const total = sentCount + failedCount
    const newStatus = failedCount === total ? 'Failed' : 'Sent'
    await (Campaign as Model<any>).updateOne({ _id: campaignId }, { status: newStatus })
  }

  const campaignUpdated = await (Campaign as Model<any>).findById(campaignId).lean() as any

  return {
    campaignId,
    campaignStatus: campaignUpdated.status,
    pending: pendingCount,
    sent: sentCount,
    failed: failedCount,
    total: pendingCount + sentCount + failedCount,
    done: pendingCount === 0
  }
})
