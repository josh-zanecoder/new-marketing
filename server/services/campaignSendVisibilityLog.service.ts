import type { CampaignRecipientModel } from '@server/types/tenant/campaignRecipient.model'
import {
  CAMPAIGN_RECIPIENT_STATUS_FAILED,
  CAMPAIGN_RECIPIENT_STATUS_PENDING,
  CAMPAIGN_RECIPIENT_STATUS_SENDING,
  CAMPAIGN_RECIPIENT_STATUS_SENT
} from '@server/utils/campaignSend/constants'

const VISIBILITY_SAMPLE_LIMIT = Number(process.env.CAMPAIGN_SEND_LOG_SAMPLE_LIMIT) || 10

type VisibilityRow = {
  email: string
  status: string
  error?: string
  sentAt?: Date
}

type LogFn = (event: string, details: Record<string, unknown>) => void

export async function logCampaignSendBatchVisibility(
  CampaignRecipient: CampaignRecipientModel,
  campaignId: string,
  logFn: LogFn,
  context: {
    sendRunId: string
    page: number
    batchEmails?: string[]
  }
): Promise<void> {
  const sampleLimit = Math.max(1, Math.min(50, VISIBILITY_SAMPLE_LIMIT))

  const [recentSent, recentFailed, nextInQueue] = await Promise.all([
    CampaignRecipient.find({
      campaign: campaignId,
      status: CAMPAIGN_RECIPIENT_STATUS_SENT,
      ...(context.batchEmails?.length ? { email: { $in: context.batchEmails } } : {})
    })
      .sort({ sentAt: -1, email: 1 })
      .limit(sampleLimit)
      .select('email status sentAt error')
      .lean<VisibilityRow[]>(),
    CampaignRecipient.find({
      campaign: campaignId,
      status: CAMPAIGN_RECIPIENT_STATUS_FAILED,
      ...(context.batchEmails?.length ? { email: { $in: context.batchEmails } } : {})
    })
      .sort({ updatedAt: -1, email: 1 })
      .limit(sampleLimit)
      .select('email status error')
      .lean<VisibilityRow[]>(),
    CampaignRecipient.find({
      campaign: campaignId,
      status: { $in: [CAMPAIGN_RECIPIENT_STATUS_PENDING, CAMPAIGN_RECIPIENT_STATUS_SENDING] }
    })
      .sort({ status: 1, email: 1 })
      .limit(sampleLimit)
      .select('email status error')
      .lean<VisibilityRow[]>()
  ])

  logFn('batch.visibility', {
    campaignId,
    sendRunId: context.sendRunId,
    page: context.page,
    sampleLimit,
    alreadySent: recentSent.map((r) => ({
      email: r.email,
      sentAt: r.sentAt ? new Date(r.sentAt).toISOString() : undefined
    })),
    failed: recentFailed.map((r) => ({
      email: r.email,
      error: r.error || 'Unknown error'
    })),
    nextInQueue: nextInQueue.map((r) => ({
      email: r.email,
      status: r.status
    }))
  })
}
