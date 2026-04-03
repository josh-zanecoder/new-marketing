import { storeToRefs } from 'pinia'
import type { Campaign, SendStatus } from '~/types/campaign'
import { useCampaignStore } from '~/store/campaignStore'

const POLL_MS = 1500

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

/**
 * Shared send progress UI + status polling for campaign list, detail, and wizard.
 * Clears its interval on unmount and via `closeSendModal` / `stopSendPolling`.
 */
export function useCampaignSendFlow() {
  const campaignStore = useCampaignStore()
  const marketingApi = useTenantMarketingApi()
  const { sendingCampaignId, sendStatus } = storeToRefs(campaignStore)

  let pollTimer: ReturnType<typeof setInterval> | null = null

  function stopSendPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  const sendProgress = computed((): CampaignSendProgress | null => {
    const s = sendStatus.value
    if (!s) return null
    const processed = s.sent + s.failed
    const pct = s.total > 0 ? (processed / s.total) * 100 : 0
    return {
      ...s,
      processed,
      pct,
      remaining: s.pending
    }
  })

  function closeSendModal() {
    campaignStore.clearSendModal()
    stopSendPolling()
  }

  /**
   * Poll until the server reports `done`, then clears sending state and runs `onComplete` with the last status.
   */
  function startSendStatusPolling(
    campaignId: string,
    onComplete: (res: SendStatus) => void | Promise<void>
  ) {
    stopSendPolling()
    async function tick() {
      if (!sendingCampaignId.value) return
      try {
        const res = await marketingApi.fetchSendCampaignStatus(campaignId)
        campaignStore.setSendStatus(res)
        if (res.done) {
          stopSendPolling()
          campaignStore.setSendingCampaignId(null)
          campaignStore.setSendStatus(null)
          await campaignStore.fetchCampaigns()
          await onComplete(res)
        }
      } catch {
        campaignStore.clearSendModal()
        stopSendPolling()
      }
    }
    void tick()
    pollTimer = setInterval(tick, POLL_MS)
  }

  onBeforeUnmount(stopSendPolling)

  return {
    canSendDraft,
    canScheduleDraft,
    sendProgress,
    startSendStatusPolling,
    stopSendPolling,
    closeSendModal
  }
}
