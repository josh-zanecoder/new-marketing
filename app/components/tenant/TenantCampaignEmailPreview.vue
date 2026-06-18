<script setup lang="ts">
import { campaignEmailPreviewSrcdoc } from '~/utils/campaignEmailPreviewSrcdoc'

const props = withDefaults(
  defineProps<{
    html: string
    title?: string
    subject?: string
    summary?: string
    /** When true, clicking the inline preview opens the full-screen modal. */
    clickable?: boolean
    showFullPreviewButton?: boolean
  }>(),
  {
    title: 'Email preview',
    subject: '',
    summary: '',
    clickable: true,
    showFullPreviewButton: true
  }
)

const srcdoc = computed(() => campaignEmailPreviewSrcdoc(props.html || ''))

const modalOpen = ref(false)
const inlineIframeRef = ref<HTMLIFrameElement | null>(null)
const modalIframeRef = ref<HTMLIFrameElement | null>(null)
const inlineIframeHeight = ref(320)

const subjectDisplay = computed(() => props.subject?.trim() || 'No subject')

function measureIframeHeight(iframe: HTMLIFrameElement | null): number {
  if (!iframe?.contentDocument?.documentElement) return 320
  const doc = iframe.contentDocument
  return Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0, 320)
}

function onInlineIframeLoad() {
  inlineIframeHeight.value = measureIframeHeight(inlineIframeRef.value) + 8
}

function onModalIframeLoad() {
  const iframe = modalIframeRef.value
  if (!iframe) return
  iframe.style.height = `${measureIframeHeight(iframe)}px`
}

function openModal() {
  if (!props.html?.trim()) return
  modalOpen.value = true
}

function closeModal() {
  modalOpen.value = false
}

let escListener: ((e: KeyboardEvent) => void) | null = null

watch(modalOpen, (open) => {
  if (!import.meta.client) return
  document.body.style.overflow = open ? 'hidden' : ''
  if (escListener) {
    window.removeEventListener('keydown', escListener)
    escListener = null
  }
  if (open) {
    escListener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
    }
    window.addEventListener('keydown', escListener)
  }
})

onBeforeUnmount(() => {
  if (!import.meta.client) return
  document.body.style.overflow = ''
  if (escListener) {
    window.removeEventListener('keydown', escListener)
    escListener = null
  }
})

watch(
  () => props.html,
  () => {
    inlineIframeHeight.value = 320
  }
)
</script>

<template>
  <div class="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02]">
    <div class="flex flex-col gap-4 border-b border-slate-100 bg-white px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0">
        <h3 v-if="title" class="text-base font-semibold text-slate-900">{{ title }}</h3>
        <p v-if="subject" class="mt-1 truncate text-sm text-slate-600" :title="subjectDisplay">
          Subject: {{ subjectDisplay }}
        </p>
        <p v-if="summary" class="mt-1 text-sm text-slate-500">{{ summary }}</p>
      </div>
      <div class="flex shrink-0 flex-wrap items-center gap-2">
        <slot name="actions" />
        <button
          v-if="showFullPreviewButton && html?.trim()"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] transition-colors hover:border-indigo-200 hover:bg-indigo-50/80 hover:text-indigo-800 sm:px-4 sm:py-2.5 sm:text-sm"
          @click="openModal"
        >
          <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
          Full preview
        </button>
      </div>
    </div>

    <div
      v-if="html?.trim()"
      class="overflow-auto bg-[#f8f4ef] px-3 py-3 sm:px-4"
      :class="[
        clickable ? 'cursor-zoom-in' : '',
        'max-h-[min(72vh,920px)]'
      ]"
      :role="clickable ? 'button' : undefined"
      :tabindex="clickable ? 0 : undefined"
      :aria-label="clickable ? `Open full email preview. Subject: ${subjectDisplay}` : undefined"
      @click="clickable ? openModal() : undefined"
      @keydown.enter.prevent="clickable ? openModal() : undefined"
      @keydown.space.prevent="clickable ? openModal() : undefined"
    >
      <iframe
        ref="inlineIframeRef"
        :srcdoc="srcdoc"
        class="pointer-events-none block w-full select-none border-0"
        :style="{ height: `${inlineIframeHeight}px` }"
        sandbox="allow-same-origin"
        title="Email preview"
        @load="onInlineIframeLoad"
      />
      <p v-if="clickable" class="pointer-events-none border-t border-slate-100 px-4 py-3 text-center text-xs text-slate-500">
        Click to open full preview
      </p>
    </div>

    <div v-else class="px-5 py-10 text-center text-sm text-slate-500">
      No email content to preview
    </div>

    <slot name="footer" />
  </div>

  <Teleport to="body">
    <div
      v-if="modalOpen && html?.trim()"
      class="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4 lg:p-6"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="`email-preview-modal-${title}`"
    >
      <div
        class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        aria-hidden="true"
        @click="closeModal"
      />
      <div
        class="relative flex h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/20 ring-1 ring-slate-900/[0.04] sm:h-[92vh] sm:rounded-2xl"
      >
        <div class="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div class="min-w-0">
            <p :id="`email-preview-modal-${title}`" class="text-base font-semibold text-slate-900 sm:text-lg">
              {{ title }}
            </p>
            <p v-if="subject" class="mt-1 truncate text-sm text-slate-600 sm:text-base" :title="subjectDisplay">
              Subject: {{ subjectDisplay }}
            </p>
          </div>
          <button
            type="button"
            class="shrink-0 rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close preview"
            @click="closeModal"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="min-h-0 flex-1 overflow-auto bg-[#f8f4ef] px-3 py-3 sm:px-4">
          <iframe
            ref="modalIframeRef"
            :srcdoc="srcdoc"
            class="block w-full min-h-[420px] border-0"
            sandbox="allow-same-origin"
            title="Email preview (full size)"
            @load="onModalIframeLoad"
          />
        </div>
      </div>
    </div>
  </Teleport>
</template>
