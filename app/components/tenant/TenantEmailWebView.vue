<script setup lang="ts">
import { useEmailWebView } from '~/composables/useEmailWebView'

const props = withDefaults(
  defineProps<{
    html: string
    previewWidth: number
    title?: string
    /** Thumbnail / inline preview — no interaction */
    passive?: boolean
    /** DevTools-style gray frame (matches EmailBuilder web view) */
    chrome?: boolean
  }>(),
  {
    title: 'Email web view',
    passive: false,
    chrome: true,
  }
)

const iframeRef = ref<HTMLIFrameElement | null>(null)
const previewWidthRef = computed(() => props.previewWidth)
const htmlRef = computed(() => props.html)

const { iframeSrc, iframeHeight, onIframeLoad } = useEmailWebView(htmlRef, previewWidthRef)

function handleLoad() {
  onIframeLoad(iframeRef.value)
}

watch(
  () => [props.html, props.previewWidth] as const,
  () => {
    if (!import.meta.client) return
    nextTick(() => onIframeLoad(iframeRef.value))
  }
)
</script>

<template>
  <div
    class="mx-auto flex shrink-0 flex-col"
    :style="{ width: `${previewWidth}px`, maxWidth: '100%' }"
  >
    <div
      :class="[
        chrome ? 'bg-[#525659] shadow-sm ring-1 ring-slate-900/10' : '',
        'overflow-hidden',
      ]"
    >
      <iframe
        ref="iframeRef"
        :key="`webview-${previewWidth}-${html.length}`"
        :src="iframeSrc || undefined"
        :title="title"
        :style="{ width: `${previewWidth}px`, maxWidth: '100%', height: `${iframeHeight}px` }"
        class="block border-0 bg-white"
        :class="{ 'pointer-events-none select-none': passive }"
        @load="handleLoad"
      />
    </div>
  </div>
</template>
