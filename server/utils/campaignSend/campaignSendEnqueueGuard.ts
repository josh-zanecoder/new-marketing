import { getTenantClientModels } from '../../models/tenant/tenantClientModels'
import type { CampaignLean, CampaignModel } from '../../types/tenant/campaign.model'
import { getTenantConnectionByDbName } from '../../tenant/connection'
import type { CampaignQueueJobData } from '../../queue/emailQueue'
import { campaignSendJobShouldBlockEnqueue } from './campaignSendJobGuard'

function logGuard(event: string, details: Record<string, unknown>) {
  console.log(`[CampaignSendEnqueueGuard] ${event}`, details)
}

/** Ratesheet-style guard: skip enqueue when the campaign stopped or superseded the run. */
export async function shouldSkipCampaignBatchEnqueue(
  data: CampaignQueueJobData
): Promise<boolean> {
  try {
    const conn = await getTenantConnectionByDbName(data.dbName)
    const { Campaign } = getTenantClientModels(conn)
    const campaign = await (Campaign as CampaignModel)
      .findById(data.campaignId)
      .select('status sendRunId')
      .lean<Pick<CampaignLean, 'status' | 'sendRunId'> | null>()

    if (!campaignSendJobShouldBlockEnqueue(campaign, data.sendRunId)) return false

    logGuard('skip', {
      campaignId: data.campaignId,
      dbName: data.dbName,
      sendRunId: data.sendRunId,
      page: data.page,
      campaignStatus: campaign?.status ?? null,
      campaignSendRunId: campaign?.sendRunId ?? null
    })
    return true
  } catch (e: unknown) {
    logGuard('guardFailed.proceed', {
      campaignId: data.campaignId,
      dbName: data.dbName,
      error: e instanceof Error ? e.message : String(e)
    })
    return false
  }
}
