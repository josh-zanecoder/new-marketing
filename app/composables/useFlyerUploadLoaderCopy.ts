import {
  FLYER_UPLOAD_LOADER_HINTS,
  FLYER_UPLOAD_LOADER_HINT_ROTATE_MS,
  FLYER_UPLOAD_LOADER_TITLE
} from '~~/shared/constants/flyerUploadCopy'

/** Rotating friendly hints for the Custom Flyers upload overlay. */
export function useFlyerUploadLoaderCopy(open: Ref<boolean>) {
  const hintIndex = ref(0)
  let timer: ReturnType<typeof setInterval> | null = null

  const title = FLYER_UPLOAD_LOADER_TITLE
  const hint = computed(
    () => FLYER_UPLOAD_LOADER_HINTS[hintIndex.value] ?? FLYER_UPLOAD_LOADER_HINTS[0]
  )

  function stop() {
    if (!timer) return
    clearInterval(timer)
    timer = null
  }

  function start() {
    stop()
    hintIndex.value = 0
    timer = setInterval(() => {
      hintIndex.value = (hintIndex.value + 1) % FLYER_UPLOAD_LOADER_HINTS.length
    }, FLYER_UPLOAD_LOADER_HINT_ROTATE_MS)
  }

  watch(
    open,
    (isOpen) => {
      if (isOpen) start()
      else stop()
    },
    { immediate: true }
  )

  onUnmounted(stop)

  return { title, hint }
}
