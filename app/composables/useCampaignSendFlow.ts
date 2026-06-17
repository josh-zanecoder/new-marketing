import { storeToRefs } from 'pinia'
import type { Campaign, SendStatus } from '~/types/campaign'
import { useCampaignStore } from '~/store/campaignStore'

function hasSendableRecipients(c: Campaign): boolean {
  if (c.recipientsType === 'manual') return (c.recipients?.length ?? 0) > 0
  if (c.recipientsType === 'list') {
    return (c.recipients?.length ?? 0) > 0 || !!c.recipientsListId?.trim()
  }
  return false
}

export function canSendDraft(c: Campaign): boolean {
  return c.status === 'Draft' && hasSendableRecipients(c)
}

/** Scheduled campaigns can be sent immediately instead of waiting for the scheduled time. */
export function canSendScheduled(c: Campaign): boolean {
  return c.status === 'Scheduled' && hasSendableRecipients(c)
}

export function canSendNow(c: Campaign): boolean {
  return canSendDraft(c) || canSendScheduled(c)
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
  const { sendStatus } = storeToRefs(campaignStore)

  const sendProgress = computed((): CampaignSendProgress | null =>
    buildCampaignSendProgress(sendStatus.value)
  )

  function closeSendModal() {
    campaignStore.clearSendModal()
  }

  function dismissSendModal() {
    campaignStore.dismissSendModal()
  }

  function openSendModal(campaignId: string) {
    campaignStore.openSendModal(campaignId)
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
    canSendScheduled,
    canSendNow,
    canScheduleDraft,
    sendProgress,
    buildCampaignSendProgress,
    startSendStatusPolling,
    resumeSendStatusPolling,
    stopSendPolling,
    isSendPolling,
    closeSendModal,
    dismissSendModal,
    openSendModal
  }
}
