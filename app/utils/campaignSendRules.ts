import type { Campaign } from '~/types/campaign'

export function campaignHasSendAudience(c: Campaign): boolean {
  if (c.recipientsType === 'manual') return (c.recipients?.length ?? 0) > 0
  if (c.recipientsType === 'list') {
    return (c.recipients?.length ?? 0) > 0 || !!c.recipientsListId?.trim()
  }
  return false
}

export function canSendDraft(c: Campaign): boolean {
  return c.status === 'Draft' && campaignHasSendAudience(c)
}

export function canScheduleDraft(c: Campaign): boolean {
  return canSendDraft(c)
}

/** Continue a paused, failed, or stuck in-flight send (unsent only). */
export function canResumeSend(c: Campaign): boolean {
  return (
    (c.status === 'Paused' || c.status === 'Failed' || c.status === 'Sending') &&
    campaignHasSendAudience(c)
  )
}

/** Legacy cancelled campaigns may still resume unsent recipients (secondary action). */
export function canResumeUnsentOnly(c: Campaign): boolean {
  return c.status === 'Cancelled' && campaignHasSendAudience(c)
}

/** @deprecated Use canResumeSend */
export const canResendCancelled = canResumeSend

/** Full re-blast to everyone on the audience. */
export function canSendAgainCampaign(c: Campaign): boolean {
  return (
    (c.status === 'Cancelled' || c.status === 'Failed') &&
    campaignHasSendAudience(c)
  )
}

/** Optional full re-blast while paused (secondary / overflow). */
export function canSendAgainWhilePaused(c: Campaign): boolean {
  return c.status === 'Paused' && campaignHasSendAudience(c)
}

export function canResumeSchedule(c: Campaign): boolean {
  return (
    (c.status === 'Paused' || c.status === 'Failed' || c.status === 'Cancelled') &&
    campaignHasSendAudience(c)
  )
}

export function canScheduleAgainCampaign(c: Campaign): boolean {
  return canSendAgainCampaign(c)
}

export function canDiscardPaused(c: Campaign): boolean {
  return c.status === 'Paused'
}

export function canScheduleCampaign(c: Campaign): boolean {
  return canScheduleDraft(c) || canResumeSchedule(c) || canScheduleAgainCampaign(c)
}

export type CampaignSendProgress = {
  campaignId?: string
  campaignStatus: string
  pending: number
  sent: number
  sending: number
  failed: number
  total: number
  done: boolean
  processed: number
  pct: number
  remaining: number
  inFlight: number
}

export function buildCampaignSendProgress(
  status: import('~/types/campaign').SendStatus | null,
  campaignId?: string
): CampaignSendProgress | null {
  if (!status) return null
  if (campaignId && status.campaignId && status.campaignId !== campaignId) return null
  const sending = status.sending ?? 0
  const processed = status.sent + status.failed + sending
  const pct = status.total > 0 ? (processed / status.total) * 100 : 0
  return {
    ...status,
    sending,
    processed,
    pct,
    remaining: status.pending,
    inFlight: sending
  }
}

/** In-flight sends can be paused or cancelled. */
export function canStopSending(
  progress: CampaignSendProgress | null,
  campaignStatus?: string
): boolean {
  if (!progress || progress.done) return false
  return progress.campaignStatus === 'Sending' || campaignStatus === 'Sending'
}

/** @deprecated Use canStopSending */
export const canCancelSending = canStopSending
