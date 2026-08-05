import {
  CAMPAIGN_UNSUBSCRIBE_SECOND_CHECK_APPROVE,
  CAMPAIGN_UNSUBSCRIBE_SECOND_CHECK_APPROVE_HINT,
  CAMPAIGN_UNSUBSCRIBE_SECOND_CHECK_DECLINE,
  CAMPAIGN_UNSUBSCRIBE_SECOND_CHECK_DECLINE_HINT,
  CAMPAIGN_UNSUBSCRIBE_SECOND_CHECK_MESSAGE,
  CAMPAIGN_UNSUBSCRIBE_SECOND_CHECK_PREVIEW,
  CAMPAIGN_UNSUBSCRIBE_SECOND_CHECK_TITLE
} from '~~/shared/campaignUnsubscribeSecondCheck'
import { useCampaignSendFlow } from '~/composables/useCampaignSendFlow'
import { useCampaignStore } from '~/store/campaignStore'
import { useAppToast } from '~/composables/useAppToast'

/**
 * Pre-send unsubscribe second-check approval UI state.
 * Pending payload is set by `campaignStore.sendCampaign` when the API pauses for approval.
 */
export function useCampaignUnsubscribeSecondCheckModal() {
  const store = useCampaignStore()
  const { startSendStatusPolling } = useCampaignSendFlow()
  const toast = useAppToast()

  const title = CAMPAIGN_UNSUBSCRIBE_SECOND_CHECK_TITLE
  const message = CAMPAIGN_UNSUBSCRIBE_SECOND_CHECK_MESSAGE
  const approveText = CAMPAIGN_UNSUBSCRIBE_SECOND_CHECK_APPROVE
  const declineText = CAMPAIGN_UNSUBSCRIBE_SECOND_CHECK_DECLINE
  const previewText = CAMPAIGN_UNSUBSCRIBE_SECOND_CHECK_PREVIEW
  const approveHint = CAMPAIGN_UNSUBSCRIBE_SECOND_CHECK_APPROVE_HINT
  const declineHint = CAMPAIGN_UNSUBSCRIBE_SECOND_CHECK_DECLINE_HINT

  const open = computed(() => store.unsubscribeSecondCheckPending != null)
  const pending = computed(() => store.unsubscribeSecondCheckPending)
  const previewOpen = computed(() => store.unsubscribeSecondCheckPreviewOpen)
  const approving = computed(() => store.unsubscribeSecondCheckApproving)

  const successOpen = ref(false)
  const successSummary = ref({
    campaignName: '',
    sent: 0,
    failed: 0,
    campaignStatus: ''
  })

  function openPreview(): void {
    store.openUnsubscribeSecondCheckPreview()
  }

  function closePreview(): void {
    store.closeUnsubscribeSecondCheckPreview()
  }

  function decline(): void {
    store.declineUnsubscribeSecondCheck()
    toast.info('Send cancelled. Edit the template, then try sending again.')
  }

  async function approve(): Promise<void> {
    const campaignId = pending.value?.campaignId
    const campaignName = pending.value?.campaignName || 'campaign'
    const { poll } = await store.approveUnsubscribeSecondCheckAndSend()
    if (!poll || !campaignId) return
    startSendStatusPolling(campaignId, async (res) => {
      successSummary.value = {
        campaignName,
        sent: res.sent,
        failed: res.failed,
        campaignStatus: res.campaignStatus
      }
      await nextTick()
      successOpen.value = true
    })
  }

  function closeSuccess(): void {
    successOpen.value = false
  }

  return {
    open,
    pending,
    previewOpen,
    approving,
    successOpen,
    successSummary,
    title,
    message,
    approveText,
    declineText,
    previewText,
    approveHint,
    declineHint,
    openPreview,
    closePreview,
    decline,
    approve,
    closeSuccess
  }
}
