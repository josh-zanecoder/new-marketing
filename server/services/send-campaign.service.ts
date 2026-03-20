import type { Model } from 'mongoose'
import { Campaign } from '../models/Campaign'
import { CampaignRecipient } from '../models/CampaignRecipient'
import { EmailTemplate } from '../models/EmailTemplate'
import { sendEmail } from './brevo.service'

const BATCH_SIZE = 25

export interface ProcessBatchResult {
  campaignId: string
  campaignStatus: string
  pending: number
  sent: number
  failed: number
  total: number
  done: boolean
}

export async function processBatch(campaignId: string): Promise<ProcessBatchResult> {
  const campaign = await (Campaign as Model<any>).findById(campaignId).lean() as any
  if (!campaign) {
    throw createError({ statusCode: 404, message: 'Campaign not found' })
  }

  let templateHtml: string | null = null
  if (campaign.emailTemplate) {
    const template = await (EmailTemplate as Model<any>).findById(campaign.emailTemplate).lean() as any
    if (template) {
      templateHtml = template.html
    }
  }

  const pending = await (CampaignRecipient as Model<any>)
    .find({ campaign: campaignId, status: 'pending' })
    .limit(BATCH_SIZE)
    .lean() as any[]

  if (pending.length > 0 && (!templateHtml || !campaign.sender?.email)) {
    console.warn('[SendCampaign] Missing template or sender:', {
      campaignId,
      hasTemplate: !!templateHtml,
      sender: campaign.sender?.email
    })
  }

  for (const r of pending) {
    if (!templateHtml || !campaign.sender?.email) {
      await (CampaignRecipient as Model<any>).updateOne(
        { _id: r._id },
        { status: 'failed', error: 'Missing email template or sender' }
      )
      continue
    }

    const result = await sendEmail({
      sender: campaign.sender,
      to: [{ email: r.email }],
      subject: campaign.subject || '(No subject)',
      htmlContent: templateHtml
    })

    if (result.error) {
      await (CampaignRecipient as Model<any>).updateOne(
        { _id: r._id },
        { status: 'failed', error: result.error }
      )
    } else {
      await (CampaignRecipient as Model<any>).updateOne(
        { _id: r._id },
        { status: 'sent', sentAt: new Date() }
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
}
