import { storeToRefs } from 'pinia'
import type { AdminCampaign } from '~/types/adminCampaign'
import { adminCampaignKey } from '~/types/adminCampaign'
import type { SendStatus } from '~/types/campaign'
import { useAdminCampaignStore } from '~/store/adminCampaignStore'
import {
  buildCampaignSendProgress
} from '~/composables/useCampaignSendFlow'

/** Admin send progress UI — polling lives in the admin Pinia store. */
export function useAdminCampaignSendFlow() {
  const campaignStore = useAdminCampaignStore()
  const { sendStatus } = storeToRefs(campaignStore)

  const sendProgress = computed(() => buildCampaignSendProgress(sendStatus.value))

  function closeSendModal() {
    campaignStore.clearSendModal()
  }

  function dismissSendModal() {
    campaignStore.dismissSendModal()
  }

  function openSendModal(c: AdminCampaign) {
    campaignStore.openSendModal(c.tenantDbName, c.id)
  }

  function startSendStatusPolling(
    c: AdminCampaign,
    onComplete: (res: SendStatus) => void | Promise<void>
  ) {
    campaignStore.startSendStatusPolling(c.tenantDbName, c.id, onComplete)
  }

  function resumeSendStatusPolling(
    c: AdminCampaign,
    onComplete: (res: SendStatus) => void | Promise<void>
  ) {
    return campaignStore.resumeSendStatusPolling(c.tenantDbName, c.id, onComplete)
  }

  function stopSendPolling() {
    campaignStore.stopSendStatusPolling()
  }

  function isSendPolling(c: AdminCampaign) {
    return campaignStore.isSendPolling(c.tenantDbName, c.id)
  }

  function pauseSend(c: AdminCampaign) {
    return campaignStore.pauseCampaignSend(c)
  }

  function stopSend(c: AdminCampaign) {
    return campaignStore.stopCampaignSend(c)
  }

  function stopAllSends() {
    return campaignStore.stopAllCampaignSends()
  }

  function cancelAllActiveSends(tenantDbName?: string) {
    return campaignStore.cancelAllActiveCampaignSends(tenantDbName)
  }

  function resumeSend(c: AdminCampaign) {
    return campaignStore.resumeCampaignSend(c)
  }

  function restartSend(c: AdminCampaign) {
    return campaignStore.restartCampaignSend(c)
  }

  function isSending(c: AdminCampaign, sendingCampaignKey: string | null) {
    return sendingCampaignKey === adminCampaignKey(c)
  }

  return {
    sendProgress,
    closeSendModal,
    dismissSendModal,
    openSendModal,
    startSendStatusPolling,
    resumeSendStatusPolling,
    stopSendPolling,
    isSendPolling,
    pauseSend,
    stopSend,
    stopAllSends,
    cancelAllActiveSends,
    resumeSend,
    restartSend,
    isSending
  }
}
