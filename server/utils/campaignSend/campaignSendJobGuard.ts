import type { CampaignLean } from '../../types/tenant/campaign.model'

export function campaignSendJobStoppingStates(campaign: Pick<CampaignLean, 'status'>): boolean {
  const s = String(campaign.status || '')
  return s === 'Sent' || s === 'Failed' || s === 'Draft' || s === 'Scheduled'
}

export function campaignSendJobStaleRun(
  campaign: Pick<CampaignLean, 'sendRunId'>,
  jobSendRunId: string
): boolean {
  const expected = campaign.sendRunId != null && String(campaign.sendRunId).length > 0
  if (!expected) return false
  return String(campaign.sendRunId) !== String(jobSendRunId || '')
}

/** True when a chunk worker should no-op (campaign stopped or superseded by a newer send run). */
export function campaignSendJobShouldSkip(
  campaign: Pick<CampaignLean, 'status' | 'sendRunId'> | null | undefined,
  jobSendRunId: string
): boolean {
  if (!campaign) return true
  if (campaign.status !== 'Sending') return true
  return campaignSendJobStaleRun(campaign, jobSendRunId)
}
