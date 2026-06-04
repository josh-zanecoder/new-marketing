import { storeToRefs } from 'pinia'
import type { Campaign, SendStatus } from '~/types/campaign'
import { useCampaignStore } from '~/store/campaignStore'

export function canSendDraft(c: Campaign): boolean {
  if (c.status !== 'Draft') return false
  if (c.recipientsType === 'manual') return (c.recipients?.length ?? 0) > 0
  if (c.recipientsType === 'list') {
    return (c.recipients?.length ?? 0) > 0 || !!c.recipientsListId?.trim()
  }
  return false
}

/** Same rules as send-now; only draft campaigns can be scheduled. */
export const canScheduleDraft = canSendDraft

export type CampaignSendProgress = SendStatus & {
  processed: number
  pct: number
  remaining: number
}

export function buildCampaignSendProgress(
  status: SendStatus | null,
  campaignId?: string
): CampaignSendProgress | null {
  if (!status) return null
  if (campaignId && status.campaignId && status.campaignId !== campaignId) return null
  const processed = status.sent + status.failed
  const pct = status.total > 0 ? (processed / status.total) * 100 : 0
  return {
    ...status,
    processed,
    pct,
    remaining: status.pending
  }
}

/**
 * Shared send progress UI for campaign list, detail, and wizard.
 * Status polling lives in the Pinia store (single timer for the whole app).
 */
export function useCampaignSendFlow() {
  const campaignStore = useCampaignStore()
  const { sendingCampaignId, sendStatus } = storeToRefs(campaignStore)

  const sendProgress = computed((): CampaignSendProgress | null =>
    buildCampaignSendProgress(sendStatus.value)
  )

  function closeSendModal() {
    campaignStore.clearSendModal()
  }

  function startSendStatusPolling(
    campaignId: string,
    onComplete: (res: SendStatus) => void | Promise<void>
  ) {
    campaignStore.startSendStatusPolling(campaignId, onComplete)
  }

  function resumeSendStatusPolling(
    campaignId: string,
    onComplete: (res: SendStatus) => void | Promise<void>
  ) {
    return campaignStore.resumeSendStatusPolling(campaignId, onComplete)
  }

  function stopSendPolling() {
    campaignStore.stopSendStatusPolling()
  }

  function isSendPolling(campaignId: string) {
    return campaignStore.isSendPolling(campaignId)
  }

  return {
    canSendDraft,
    canScheduleDraft,
    sendProgress,
    buildCampaignSendProgress,
    startSendStatusPolling,
    resumeSendStatusPolling,
    stopSendPolling,
    isSendPolling,
    closeSendModal
  }
}
