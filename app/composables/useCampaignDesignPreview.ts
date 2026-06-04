import type { Ref } from 'vue'
import { mergeMustacheTemplate } from '~~/shared/utils/emailTemplateMerge'

/** Merge-tag preview for campaign design iframe (upload + editor templates). */
export function useCampaignDesignPreview(
  marketingApi: ReturnType<typeof useTenantMarketingApi>,
  savedTemplateHtml: Ref<string | null>,
  form: Ref<{
    recipientsMode: 'list' | 'manual'
    recipientsListId: string
    recipientsManual: string[]
  }>,
  campaignIdRef: Ref<string | null>
) {
  const designPreviewMergeRoot = ref<Record<string, unknown>>({})
  let mergePreviewTimer: ReturnType<typeof setTimeout> | null = null

  function isManualContactIdString(raw: string): boolean {
    return /^[a-f0-9]{24}$/i.test(String(raw ?? '').trim())
  }

  async function refreshDesignPreviewMerge() {
    if (!savedTemplateHtml.value || !import.meta.client) return
    const manualIds = form.value.recipientsManual
      .map((id) => id.trim())
      .filter(isManualContactIdString)
    const campaignId = campaignIdRef.value?.trim()
    try {
      if (campaignId && /^[a-f0-9]{24}$/i.test(campaignId)) {
        const res = await marketingApi.fetchEmailMergeContext({ campaignId })
        designPreviewMergeRoot.value = res.mergeRoot ?? {}
        return
      }
      const res = await marketingApi.fetchEmailMergeContext({
        recipientsType: form.value.recipientsMode,
        recipientsListId: form.value.recipientsListId || undefined,
        recipientsManual: manualIds.length ? manualIds : undefined
      })
      designPreviewMergeRoot.value = res.mergeRoot ?? {}
    } catch {
      designPreviewMergeRoot.value = {}
    }
  }

  function scheduleDesignPreviewMerge() {
    if (!import.meta.client) return
    if (mergePreviewTimer) clearTimeout(mergePreviewTimer)
    mergePreviewTimer = setTimeout(() => {
      mergePreviewTimer = null
      void refreshDesignPreviewMerge()
    }, 350)
  }

  const designPreviewHtml = computed(() => {
    const raw = savedTemplateHtml.value
    if (!raw) return ''
    return mergeMustacheTemplate(raw, designPreviewMergeRoot.value)
  })

  watch(
    () =>
      [
        savedTemplateHtml.value,
        form.value.recipientsMode,
        form.value.recipientsListId,
        form.value.recipientsManual.join('\n'),
        campaignIdRef.value
      ] as const,
    () => scheduleDesignPreviewMerge(),
    { immediate: true }
  )

  onBeforeUnmount(() => {
    if (mergePreviewTimer) clearTimeout(mergePreviewTimer)
  })

  return { designPreviewHtml, refreshDesignPreviewMerge }
}
