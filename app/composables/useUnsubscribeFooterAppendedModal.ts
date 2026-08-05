import {
  EMAIL_TEMPLATE_UNSUBSCRIBE_FOOTER_APPENDED_CONFIRM,
  EMAIL_TEMPLATE_UNSUBSCRIBE_FOOTER_APPENDED_MESSAGE,
  EMAIL_TEMPLATE_UNSUBSCRIBE_FOOTER_APPENDED_PREVIEW,
  EMAIL_TEMPLATE_UNSUBSCRIBE_FOOTER_APPENDED_TITLE
} from '~~/shared/emailTemplateUnsubscribe'

/**
 * Opens an info modal when the unsubscribe first-check appends the system footer.
 * `openIfAppended(true, html)` returns a promise that resolves when the user dismisses the modal.
 * Preview opens the HTML preview overlay without dismissing the info modal.
 */
export function useUnsubscribeFooterAppendedModal() {
  const open = ref(false)
  const previewOpen = ref(false)
  const previewHtml = ref('')
  let resolveDismiss: (() => void) | null = null

  const title = EMAIL_TEMPLATE_UNSUBSCRIBE_FOOTER_APPENDED_TITLE
  const message = EMAIL_TEMPLATE_UNSUBSCRIBE_FOOTER_APPENDED_MESSAGE
  const confirmText = EMAIL_TEMPLATE_UNSUBSCRIBE_FOOTER_APPENDED_CONFIRM
  const previewText = EMAIL_TEMPLATE_UNSUBSCRIBE_FOOTER_APPENDED_PREVIEW

  function closePreview(): void {
    previewOpen.value = false
  }

  function openPreview(): void {
    if (!previewHtml.value.trim()) return
    previewOpen.value = true
  }

  function close(): void {
    previewOpen.value = false
    open.value = false
    const resolve = resolveDismiss
    resolveDismiss = null
    resolve?.()
  }

  function openIfAppended(footerAppended: boolean, html = ''): Promise<void> {
    if (!footerAppended) return Promise.resolve()
    previewHtml.value = html
    previewOpen.value = false
    open.value = true
    return new Promise((resolve) => {
      resolveDismiss = resolve
    })
  }

  return {
    open,
    previewOpen,
    previewHtml,
    title,
    message,
    confirmText,
    previewText,
    close,
    openPreview,
    closePreview,
    openIfAppended
  }
}
