import type { Ref } from 'vue'

/**
 * Campaign wizard design preview — shows stored HTML as-is (including `{{variables}}`).
 * Merge tags are resolved only at send/test time, matching the EmailBuilder edit view.
 */
export function useCampaignDesignPreview(savedTemplateHtml: Ref<string | null>) {
  const designPreviewHtml = computed(() => savedTemplateHtml.value?.trim() ?? '')

  return { designPreviewHtml }
}
