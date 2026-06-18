<script setup lang="ts">
import {
  EMAIL_TEMPLATE_THUMB_LAYOUT_WIDTH,
  emailTemplateThumbnailSrcdoc
} from '~/utils/emailTemplateThumbnailSrcdoc'

const props = defineProps<{
  html: string
  title?: string
}>()

const THUMB_PADDING = 10
const FALLBACK_CONTENT_HEIGHT = 720

const containerRef = ref<HTMLElement | null>(null)
const iframeRef = ref<HTMLIFrameElement | null>(null)
const contentHeight = ref(FALLBACK_CONTENT_HEIGHT)
const scale = ref(0.5)

function measureIframeContentHeight(iframe: HTMLIFrameElement): number {
  const doc = iframe.contentDocument
  if (!doc) return FALLBACK_CONTENT_HEIGHT

  const wrap = doc.getElementById('preview-wrap')
  const body = doc.body
  const root = doc.documentElement

  const heights = [
    wrap?.scrollHeight,
    wrap?.offsetHeight,
    body?.scrollHeight,
    body?.offsetHeight,
    root?.scrollHeight
  ].filter((value): value is number => typeof value === 'number' && value > 0)

  return heights.length ? Math.max(...heights) : FALLBACK_CONTENT_HEIGHT
}

function updateScale() {
  const container = containerRef.value
  if (!container) return

  const containerWidth = container.clientWidth
  const containerHeight = container.clientHeight
  if (!containerWidth || !containerHeight) return

  const innerWidth = Math.max(containerWidth - THUMB_PADDING * 2, 1)
  const innerHeight = Math.max(containerHeight - THUMB_PADDING * 2, 1)
  const layoutHeight = Math.max(contentHeight.value, 120)

  const widthScale = innerWidth / EMAIL_TEMPLATE_THUMB_LAYOUT_WIDTH
  const heightScale = innerHeight / layoutHeight

  scale.value = Math.min(widthScale, heightScale, 1)
}

function scheduleMeasure() {
  const iframe = iframeRef.value
  if (!iframe) return

  const measure = () => {
    contentHeight.value = measureIframeContentHeight(iframe)
    updateScale()
  }

  measure()
  requestAnimationFrame(measure)
  window.setTimeout(measure, 150)
  window.setTimeout(measure, 500)
}

function onIframeLoad() {
  scheduleMeasure()
}

let resizeObserver: ResizeObserver | null = null

watch(
  () => props.html,
  () => {
    contentHeight.value = FALLBACK_CONTENT_HEIGHT
    scale.value = 0.5
    nextTick(updateScale)
  }
)

onMounted(() => {
  if (!import.meta.client || !containerRef.value) return

  resizeObserver = new ResizeObserver(() => updateScale())
  resizeObserver.observe(containerRef.value)
  updateScale()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})

const frameStyle = computed(() => ({
  width: `${EMAIL_TEMPLATE_THUMB_LAYOUT_WIDTH}px`,
  height: `${contentHeight.value}px`,
  left: '50%',
  top: '50%',
  transform: `translate(-50%, -50%) scale(${scale.value})`
}))
</script>

<template>
  <div
    ref="containerRef"
    class="email-template-thumbnail relative h-full w-full overflow-hidden bg-[#f8f4ef]"
  >
    <iframe
      v-if="html?.trim()"
      ref="iframeRef"
      :key="html"
      :srcdoc="emailTemplateThumbnailSrcdoc(html)"
      :title="title ?? 'Email template preview'"
      class="email-template-thumbnail__frame pointer-events-none absolute max-w-none border-0"
      :style="frameStyle"
      sandbox="allow-same-origin"
      tabindex="-1"
      @load="onIframeLoad"
    />
    <div
      v-else
      class="flex h-full min-h-[8rem] items-center justify-center text-sm text-slate-400"
    >
      No preview
    </div>
  </div>
</template>
