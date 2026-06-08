import { storeToRefs } from 'pinia'
import { useCampaignStore } from '~/store/campaignStore'
import { fetchErrorMessage } from '~/utils/fetchErrorMessage'
import {
  buildCampaignSendProgress,
  canCancelSending,
  canDiscardPaused,
  canResendCancelled,
  canResumeSchedule,
  canResumeSend,
  canResumeUnsentOnly,
  canScheduleAgainCampaign,
  canScheduleCampaign,
  canScheduleDraft,
  canSendAgainCampaign,
  canSendAgainWhilePaused,
  canSendDraft,
  canStopSending,
  type CampaignSendProgress
} from '~/utils/campaignSendRules'

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
    onComplete: (res: import('~/types/campaign').SendStatus) => void | Promise<void>
  ) {
    campaignStore.startSendStatusPolling(campaignId, onComplete)
  }

  function resumeSendStatusPolling(
    campaignId: string,
    onComplete: (res: import('~/types/campaign').SendStatus) => void | Promise<void>
  ) {
    return campaignStore.resumeSendStatusPolling(campaignId, onComplete)
  }

  function stopSendPolling() {
    campaignStore.stopSendStatusPolling()
  }

  async function pauseSendingCampaign(campaignId: string) {
    campaignStore.sendError = null
    try {
      return await campaignStore.pauseSendingCampaign(campaignId)
    } catch (e: unknown) {
      campaignStore.sendError = fetchErrorMessage(e, 'Failed to pause send')
      throw e
    }
  }

  async function cancelSendingCampaign(campaignId: string) {
    campaignStore.sendError = null
    try {
      return await campaignStore.cancelSendingCampaign(campaignId)
    } catch (e: unknown) {
      campaignStore.sendError = fetchErrorMessage(e, 'Failed to cancel send')
      throw e
    }
  }

  async function discardPausedCampaign(campaignId: string) {
    campaignStore.sendError = null
    try {
      return await campaignStore.discardPausedCampaign(campaignId)
    } catch (e: unknown) {
      campaignStore.sendError = fetchErrorMessage(e, 'Failed to cancel paused send')
      throw e
    }
  }

  function isSendPolling(campaignId: string) {
    return campaignStore.isSendPolling(campaignId)
  }

  return {
    canSendDraft,
    canScheduleDraft,
    canResumeSend,
    canResumeUnsentOnly,
    canResendCancelled,
    canSendAgainCampaign,
    canSendAgainWhilePaused,
    canResumeSchedule,
    canScheduleAgainCampaign,
    canDiscardPaused,
    canScheduleCampaign,
    canStopSending,
    canCancelSending,
    sendProgress,
    buildCampaignSendProgress,
    startSendStatusPolling,
    resumeSendStatusPolling,
    stopSendPolling,
    pauseSendingCampaign,
    cancelSendingCampaign,
    discardPausedCampaign,
    isSendPolling,
    closeSendModal,
    dismissSendModal,
    openSendModal
  }
}
