import { buildFlyerFileUrl } from '~~/shared/utils/flyerFileUrl'
import { renderFlyerPdfThumbnailFromBytes } from '~/utils/renderFlyerPdfThumbnail'

const thumbnailCache = new Map<string, string>()

function resolveRefString(
  value: Ref<string | undefined> | Ref<string> | string | undefined
): string {
  if (value == null) return ''
  const raw = typeof value === 'string' ? value : value.value
  return String(raw ?? '').trim()
}

/** Load + cache a first-page JPEG thumbnail for a flyer PDF. */
export function useFlyerPdfThumbnail(
  flyerId: Ref<string> | string,
  fileUrl?: Ref<string | undefined> | Ref<string> | string
) {
  const id = computed(() => resolveRefString(flyerId))
  const resolvedFileUrl = computed(() => {
    const override = resolveRefString(fileUrl)
    if (override) return override
    return buildFlyerFileUrl(id.value)
  })
  const cacheKey = computed(() => resolvedFileUrl.value || id.value)
  const thumbnailUrl = ref('')
  const pending = ref(false)
  const failed = ref(false)

  async function load() {
    const flyerIdValue = id.value
    const url = resolvedFileUrl.value
    const key = cacheKey.value
    if (!flyerIdValue || !url || !import.meta.client) return

    const cached = thumbnailCache.get(key)
    if (cached) {
      thumbnailUrl.value = cached
      failed.value = false
      return
    }

    pending.value = true
    failed.value = false
    try {
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) throw new Error(`Flyer file HTTP ${res.status}`)
      const buffer = new Uint8Array(await res.arrayBuffer())
      const dataUrl = await renderFlyerPdfThumbnailFromBytes(buffer)
      thumbnailCache.set(key, dataUrl)
      if (cacheKey.value === key) {
        thumbnailUrl.value = dataUrl
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[flyerPdfThumbnail] render failed', { flyerId: flyerIdValue, error: message })
      if (cacheKey.value === key) {
        failed.value = true
        thumbnailUrl.value = ''
      }
    } finally {
      if (cacheKey.value === key) pending.value = false
    }
  }

  watch(cacheKey, () => {
    thumbnailUrl.value = ''
    failed.value = false
    void load()
  }, { immediate: true })

  return { thumbnailUrl, pending, failed, reload: load }
}
