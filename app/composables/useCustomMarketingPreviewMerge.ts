import type { ComputedRef, Ref } from 'vue'
import { computed, ref, watch } from 'vue'
import { renderCustomMarketingPreviewTemplate } from '~~/shared/customMarketingMessagePreview'
import { useTenantMarketingApi } from '~/composables/useTenantMarketingApi'

export type CustomMarketingPreviewMergeBinders = {
  previewSubject: ComputedRef<string>
  previewBodyHtml: ComputedRef<string>
  mergePending: Ref<boolean>
  refreshPreviewMerge: () => Promise<void>
}

function readString(value: Ref<string> | ComputedRef<string> | string): string {
  if (typeof value === 'string') return value
  return value.value
}

/** Loads `/email/merge-context` for the selected list and fills Preview subject/body tags. */
export function useCustomMarketingPreviewMerge(options: {
  previewOpen: Ref<boolean>
  recipientListId: Ref<string> | ComputedRef<string> | string
  subject: Ref<string> | ComputedRef<string> | string
  bodyHtml: Ref<string> | ComputedRef<string> | string
}): CustomMarketingPreviewMergeBinders {
  const marketingApi = useTenantMarketingApi()
  const mergeRoot = ref<Record<string, unknown>>({})
  const mergePending = ref(false)
  let requestSeq = 0

  async function refreshPreviewMerge(): Promise<void> {
    const listId = readString(options.recipientListId).trim()
    const seq = ++requestSeq
    if (!listId) {
      mergeRoot.value = {}
      mergePending.value = false
      return
    }
    mergePending.value = true
    try {
      const root = await marketingApi.fetchEmailMergeContextOrEmpty({
        recipientsType: 'list',
        recipientsListId: listId
      })
      if (seq !== requestSeq) return
      mergeRoot.value = root
    } finally {
      if (seq === requestSeq) mergePending.value = false
    }
  }

  watch(
    () => [options.previewOpen.value, readString(options.recipientListId)] as const,
    ([open]) => {
      if (!open) return
      void refreshPreviewMerge()
    }
  )

  const previewSubject = computed(() =>
    renderCustomMarketingPreviewTemplate(
      readString(options.subject),
      mergeRoot.value,
      readString(options.recipientListId)
    )
  )

  const previewBodyHtml = computed(() => {
    const raw = readString(options.bodyHtml).trim() || '<p></p>'
    return renderCustomMarketingPreviewTemplate(
      raw,
      mergeRoot.value,
      readString(options.recipientListId)
    )
  })

  return { previewSubject, previewBodyHtml, mergePending, refreshPreviewMerge }
}
