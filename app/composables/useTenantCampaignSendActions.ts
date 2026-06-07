import type { Campaign, SendStatus } from '~/types/campaign'
import { useCampaignStore } from '~/store/campaignStore'
import { isTerminalSendStop } from '~/utils/campaignActionRules'

type SendSuccessSummary = {
  campaignName: string
  sent: number
  failed: number
  campaignStatus: string
}

type UseTenantCampaignSendActionsOptions = {
  getCampaignName: (campaignId: string) => string
  /** Called after polling completes, before showing the success modal. */
  onPollingComplete?: () => void | Promise<void>
}

export function useTenantCampaignSendActions(options: UseTenantCampaignSendActionsOptions) {
  const store = useCampaignStore()
  const { startSendStatusPolling, openSendModal } = useCampaignSendFlow()
  const sendSuccessSummary = ref<SendSuccessSummary | null>(null)

  function onSendComplete(campaignId: string) {
    return async (res: SendStatus) => {
      await options.onPollingComplete?.()
      await nextTick()
      sendSuccessSummary.value = {
        campaignName: options.getCampaignName(campaignId),
        sent: res.sent,
        failed: res.failed,
        campaignStatus: res.campaignStatus
      }
    }
  }

  async function startSendWithPolling(
    c: Campaign,
    action: (campaign: Campaign) => Promise<{ poll: boolean }>
  ) {
    const { poll } = await action(c)
    if (!poll) return
    startSendStatusPolling(c.id, onSendComplete(c.id))
  }

  async function sendDraft(c: Campaign) {
    await startSendWithPolling(c, (campaign) => store.sendCampaign(campaign))
  }

  async function resumeSend(c: Campaign) {
    await startSendWithPolling(c, (campaign) => store.retryFailedCampaign(campaign))
  }

  async function resumeUnsentOnly(c: Campaign) {
    await startSendWithPolling(c, (campaign) => store.retryFailedCampaign(campaign))
  }

  async function sendAgain(c: Campaign) {
    await startSendWithPolling(c, (campaign) => store.sendAgainCampaign(campaign))
  }

  function openStopSendModal(campaignId: string) {
    openSendModal(campaignId)
  }

  function closeSendSuccessModal() {
    sendSuccessSummary.value = null
  }

  return {
    sendSuccessSummary,
    sendDraft,
    resumeSend,
    resumeUnsentOnly,
    sendAgain,
    openStopSendModal,
    closeSendSuccessModal
  }
}

export function useTenantSendModalClose(onTerminalStop: () => void | Promise<void>) {
  const campaignStore = useCampaignStore()
  const { sendStatus, sendCancelReport } = storeToRefs(campaignStore)
  const { closeSendModal, dismissSendModal } = useCampaignSendFlow()

  async function handleSendModalClose() {
    const terminalStop = isTerminalSendStop(sendCancelReport.value, sendStatus.value)
    dismissSendModal()
    if (terminalStop) {
      closeSendModal()
      await onTerminalStop()
    }
  }

  return { handleSendModalClose }
}
