import {
  buildCampaignListFullPreviewContent,
  CAMPAIGN_LIST_FULL_PREVIEW_ACTION_TITLE,
  CAMPAIGN_LIST_FULL_PREVIEW_ARIA_LABEL,
  CAMPAIGN_LIST_FULL_PREVIEW_EMPTY,
  CAMPAIGN_LIST_FULL_PREVIEW_LOAD_ERROR,
  CAMPAIGN_LIST_FULL_PREVIEW_LOG_TAG
} from '~~/shared/campaignListFullPreview'
import { useAppToast } from '~/composables/useAppToast'
import { useTenantMarketingApi } from '~/composables/useTenantMarketingApi'
import { useCampaignStore } from '~/store/campaignStore'

type CampaignListPreviewTarget = {
  id: string
  name?: string
}

/**
 * Campaign list Full Preview: fetch detail + merge tags, open read-only modal.
 * Never mutates campaign content or settings.
 */
export function useCampaignListFullPreview() {
  const marketingApi = useTenantMarketingApi()
  const campaignStore = useCampaignStore()
  const toast = useAppToast()

  const open = ref(false)
  const loading = ref(false)
  const loadingCampaignId = ref<string | null>(null)
  const name = ref('')
  const subject = ref('')
  const html = ref('')

  async function openFullPreview(campaign: CampaignListPreviewTarget): Promise<void> {
    const campaignId = String(campaign?.id ?? '').trim()
    if (!campaignId || loading.value) return

    loading.value = true
    loadingCampaignId.value = campaignId
    try {
      let detail = campaignStore.getCampaignDetailCache(campaignId)
      if (!detail) {
        const res = await marketingApi.fetchCampaignById(campaignId)
        detail = res.campaign
        campaignStore.setCampaignDetailCache(campaignId, detail)
      }

      const mergeRoot = await marketingApi.fetchEmailMergeContextOrEmpty({ campaignId })
      const content = buildCampaignListFullPreviewContent(detail, mergeRoot)
      if (!content.hasHtml) {
        toast.info(CAMPAIGN_LIST_FULL_PREVIEW_EMPTY)
        return
      }

      name.value = content.name
      subject.value = content.subject
      html.value = content.html
      open.value = true
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`${CAMPAIGN_LIST_FULL_PREVIEW_LOG_TAG} load failed`, {
        campaignId,
        error: message
      })
      toast.error(CAMPAIGN_LIST_FULL_PREVIEW_LOAD_ERROR)
    } finally {
      loading.value = false
      loadingCampaignId.value = null
    }
  }

  function closeFullPreview(): void {
    open.value = false
  }

  function isPreviewLoadingFor(campaignId: string): boolean {
    return loading.value && loadingCampaignId.value === campaignId
  }

  return {
    open,
    loading,
    loadingCampaignId,
    name,
    subject,
    html,
    actionTitle: CAMPAIGN_LIST_FULL_PREVIEW_ACTION_TITLE,
    ariaLabel: CAMPAIGN_LIST_FULL_PREVIEW_ARIA_LABEL,
    openFullPreview,
    closeFullPreview,
    isPreviewLoadingFor
  }
}
