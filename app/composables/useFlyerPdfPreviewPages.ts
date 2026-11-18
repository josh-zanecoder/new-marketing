import { buildFlyerFileUrl } from '~~/shared/utils/flyerFileUrl'
import { renderFlyerPdfPagesFromBytes } from '~/utils/renderFlyerPdfPages'

/** Load a flyer PDF and rasterize pages for the chrome-free preview modal. */
export function useFlyerPdfPreviewPages(
  flyerId: Ref<string>,
  enabled: Ref<boolean>
) {
  const pages = ref<string[]>([])
  const pending = ref(false)
  const failed = ref(false)
  const progressLabel = ref('')

  async function load() {
    const id = flyerId.value.trim()
    if (!enabled.value || !id || !import.meta.client) {
      pages.value = []
      return
    }

    pending.value = true
    failed.value = false
    pages.value = []
    progressLabel.value = 'Loading PDF…'

    try {
      const res = await fetch(buildFlyerFileUrl(id), { credentials: 'include' })
      if (!res.ok) throw new Error(`Flyer file HTTP ${res.status}`)
      const bytes = new Uint8Array(await res.arrayBuffer())
      const rendered = await renderFlyerPdfPagesFromBytes(bytes, {
        onPage: (pageNumber, total) => {
          progressLabel.value = `Rendering page ${pageNumber} of ${total}…`
        }
      })
      if (flyerId.value.trim() === id && enabled.value) {
        pages.value = rendered
        progressLabel.value = ''
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[flyerPdfPreview] render failed', { flyerId: id, error: message })
      if (flyerId.value.trim() === id) {
        failed.value = true
        pages.value = []
        progressLabel.value = ''
      }
    } finally {
      if (flyerId.value.trim() === id) pending.value = false
    }
  }

  watch(
    [flyerId, enabled],
    () => {
      void load()
    },
    { immediate: true }
  )

  return { pages, pending, failed, progressLabel, reload: load }
}
