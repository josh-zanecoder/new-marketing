import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import {
  EMAIL_TEMPLATE_UNSUBSCRIBE_FOOTER_APPENDED_CONFIRM,
  EMAIL_TEMPLATE_UNSUBSCRIBE_FOOTER_APPENDED_MESSAGE,
  EMAIL_TEMPLATE_UNSUBSCRIBE_FOOTER_APPENDED_PREVIEW,
  EMAIL_TEMPLATE_UNSUBSCRIBE_FOOTER_APPENDED_TITLE
} from '~~/shared/emailTemplateUnsubscribe'

/**
 * Mirrors `useUnsubscribeFooterAppendedModal` without Nuxt auto-imports so vitest can run it.
 */
function createUnsubscribeFooterAppendedModalState() {
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

describe('useUnsubscribeFooterAppendedModal behavior', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('exposes modal copy constants', () => {
    const modal = createUnsubscribeFooterAppendedModalState()
    expect(modal.title).toBe(EMAIL_TEMPLATE_UNSUBSCRIBE_FOOTER_APPENDED_TITLE)
    expect(modal.message).toBe(EMAIL_TEMPLATE_UNSUBSCRIBE_FOOTER_APPENDED_MESSAGE)
    expect(modal.confirmText).toBe(EMAIL_TEMPLATE_UNSUBSCRIBE_FOOTER_APPENDED_CONFIRM)
    expect(modal.previewText).toBe(EMAIL_TEMPLATE_UNSUBSCRIBE_FOOTER_APPENDED_PREVIEW)
  })

  it('resolves immediately when footer was not appended', async () => {
    const modal = createUnsubscribeFooterAppendedModalState()
    await expect(modal.openIfAppended(false)).resolves.toBeUndefined()
    expect(modal.open.value).toBe(false)
  })

  it('opens modal and resolves when closed after append', async () => {
    const modal = createUnsubscribeFooterAppendedModalState()
    const pending = modal.openIfAppended(true, '<p>safe</p>')
    expect(modal.open.value).toBe(true)
    expect(modal.previewHtml.value).toBe('<p>safe</p>')
    modal.close()
    await expect(pending).resolves.toBeUndefined()
    expect(modal.open.value).toBe(false)
  })

  it('opens HTML preview without dismissing the notice modal', async () => {
    const modal = createUnsubscribeFooterAppendedModalState()
    const pending = modal.openIfAppended(true, '<p>with footer</p>')
    modal.openPreview()
    expect(modal.previewOpen.value).toBe(true)
    expect(modal.open.value).toBe(true)
    modal.closePreview()
    expect(modal.previewOpen.value).toBe(false)
    expect(modal.open.value).toBe(true)
    modal.close()
    await pending
  })
})
