import { renderFlyerPdfThumbnailFromBytes } from '~/utils/renderFlyerPdfThumbnail'

const thumbnailCache = new Map<string, string>()

/** Load + cache a first-page JPEG thumbnail for a tenant flyer PDF. */
export function useFlyerPdfThumbnail(flyerId: Ref<string> | string) {
  const id = computed(() => (typeof flyerId === 'string' ? flyerId : flyerId.value).trim())
  const thumbnailUrl = ref('')
  const pending = ref(false)
  const failed = ref(false)

  async function load() {
    const flyerIdValue = id.value
    if (!flyerIdValue || !import.meta.client) return

    const cached = thumbnailCache.get(flyerIdValue)
    if (cached) {
      thumbnailUrl.value = cached
      failed.value = false
      return
    }

    pending.value = true
    failed.value = false
    try {
      const res = await fetch(
        `/api/v1/tenant/flyers/${encodeURIComponent(flyerIdValue)}/file`,
        { credentials: 'include' }
      )
      if (!res.ok) throw new Error(`Flyer file HTTP ${res.status}`)
      const buffer = new Uint8Array(await res.arrayBuffer())
      const dataUrl = await renderFlyerPdfThumbnailFromBytes(buffer)
      thumbnailCache.set(flyerIdValue, dataUrl)
      if (id.value === flyerIdValue) {
        thumbnailUrl.value = dataUrl
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[flyerPdfThumbnail] render failed', { flyerId: flyerIdValue, error: message })
      if (id.value === flyerIdValue) {
        failed.value = true
        thumbnailUrl.value = ''
      }
    } finally {
      if (id.value === flyerIdValue) pending.value = false
    }
  }

  watch(id, () => {
    thumbnailUrl.value = ''
    failed.value = false
    void load()
  }, { immediate: true })

  return { thumbnailUrl, pending, failed, reload: load }
}
