import { onMounted, onUnmounted, ref, watch, type Ref } from 'vue'
import { shouldCloseCustomMarketingMessagePreview } from '~~/shared/customMarketingMessagePreview'

export type CustomMarketingMessagePreviewBinders = {
  previewOpen: Ref<boolean>
  openPreview: () => void
  closePreview: () => void
}

/** Browser + Gmail chrome only while the Preview modal is open. */
export function useCustomMarketingMessagePreview(): CustomMarketingMessagePreviewBinders {
  const previewOpen = ref(false)

  function openPreview(): void {
    previewOpen.value = true
  }

  function closePreview(): void {
    previewOpen.value = false
  }

  function onPreviewKeydown(event: KeyboardEvent): void {
    if (!shouldCloseCustomMarketingMessagePreview(event.key, previewOpen.value)) return
    event.preventDefault()
    closePreview()
  }

  onMounted(() => {
    if (import.meta.client) window.addEventListener('keydown', onPreviewKeydown)
  })

  onUnmounted(() => {
    if (import.meta.client) window.removeEventListener('keydown', onPreviewKeydown)
    if (import.meta.client) document.body.style.overflow = ''
  })

  watch(previewOpen, (open) => {
    if (!import.meta.client) return
    document.body.style.overflow = open ? 'hidden' : ''
  })

  return { previewOpen, openPreview, closePreview }
}
