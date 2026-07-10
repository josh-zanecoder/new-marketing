/** Locks app shell scroll (html, body, marketing main) — ref-counted for nested overlays. */
import type { Ref } from 'vue'

let lockCount = 0
let savedBodyOverflow = ''
let savedHtmlOverflow = ''
let savedMainOverflow = ''

function mainScrollElement(): HTMLElement | null {
  if (!import.meta.client) return null
  return (
    document.querySelector<HTMLElement>('.admin-main-scroll') ??
    document.querySelector<HTMLElement>('.marketing-main-scroll')
  )
}

function applyMarketingScrollLock() {
  if (!import.meta.client) return
  savedBodyOverflow = document.body.style.overflow
  savedHtmlOverflow = document.documentElement.style.overflow
  const main = mainScrollElement()
  savedMainOverflow = main?.style.overflow ?? ''
  document.body.style.overflow = 'hidden'
  document.documentElement.style.overflow = 'hidden'
  if (main) main.style.overflow = 'hidden'
}

function releaseMarketingScrollLock() {
  if (!import.meta.client) return
  document.body.style.overflow = savedBodyOverflow
  document.documentElement.style.overflow = savedHtmlOverflow
  const main = mainScrollElement()
  if (main) main.style.overflow = savedMainOverflow
}

export function forceReleaseMarketingScrollLock() {
  if (!import.meta.client) return
  lockCount = 0
  releaseMarketingScrollLock()
}

export function lockMarketingScroll() {
  if (!import.meta.client) return
  if (lockCount === 0) applyMarketingScrollLock()
  lockCount++
}

export function unlockMarketingScroll() {
  if (!import.meta.client) return
  if (lockCount <= 0) return
  lockCount--
  if (lockCount === 0) releaseMarketingScrollLock()
}

/** Sync scroll lock to a boolean ref; releases on unmount. */
export function useMarketingScrollLock(isLocked: Ref<boolean>) {
  watch(
    isLocked,
    (locked) => {
      if (locked) lockMarketingScroll()
      else unlockMarketingScroll()
    },
    { immediate: true }
  )

  onBeforeUnmount(() => {
    if (isLocked.value) unlockMarketingScroll()
  })
}
