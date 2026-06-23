import {
  createEmailPreviewBlobUrl,
  prepareEmailHtmlForPreviewIframe,
} from '~/utils/campaignEmailWebView'

/** Blob-URL web view iframe — same rendering as opening HTML in Chrome / Edge. */
export function useEmailWebView(html: Ref<string>, previewWidth: Ref<number>) {
  const iframeSrc = ref('')
  const iframeHeight = ref(320)

  const previewHtml = computed(() =>
    prepareEmailHtmlForPreviewIframe(html.value || '', previewWidth.value)
  )

  function revokeSrc() {
    if (iframeSrc.value.startsWith('blob:')) {
      URL.revokeObjectURL(iframeSrc.value)
      iframeSrc.value = ''
    }
  }

  watch(
    previewHtml,
    (doc) => {
      if (!import.meta.client) return
      revokeSrc()
      if (doc) {
        iframeSrc.value = createEmailPreviewBlobUrl(doc)
      }
    },
    { immediate: true }
  )

  onBeforeUnmount(revokeSrc)

  function measureIframeHeight(iframe: HTMLIFrameElement | null): number {
    if (!iframe?.contentDocument?.documentElement) return 320
    const doc = iframe.contentDocument
    return Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0, 320)
  }

  function onIframeLoad(iframe: HTMLIFrameElement | null) {
    iframeHeight.value = measureIframeHeight(iframe)
  }

  return {
    iframeSrc,
    iframeHeight,
    previewHtml,
    measureIframeHeight,
    onIframeLoad,
  }
}
