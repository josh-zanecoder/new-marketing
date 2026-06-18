<script setup lang="ts">
import { campaignEmailPreviewSrcdoc } from '~/utils/campaignEmailPreviewSrcdoc'

const props = withDefaults(
  defineProps<{
    html: string
    /** Stable raw template HTML for the inline thumbnail (avoids remount on merge-tag refresh). */
    thumbnailHtml?: string
    title?: string
    subject?: string
    summary?: string
    emptyMessage?: string
    /** Flat layout when nested inside the campaign wizard card. */
    embedded?: boolean
  }>(),
  {
    thumbnailHtml: '',
    title: 'Email preview',
    subject: '',
    summary: '',
    emptyMessage: 'No email design selected yet.',
    embedded: false
  }
)

const previewModalOpen = ref(false)
const modalIframeRef = ref<HTMLIFrameElement | null>(null)

useMarketingScrollLock(previewModalOpen)

const hasHtml = computed(() => Boolean(props.html?.trim()))
const thumbnailSource = computed(() => props.thumbnailHtml?.trim() || props.html?.trim() || '')
const subjectDisplay = computed(() => props.subject?.trim() || 'No subject')
const srcdoc = computed(() => campaignEmailPreviewSrcdoc(props.html || ''))

const rootClass = computed(() =>
  props.embedded
    ? 'overflow-hidden bg-white'
    : 'overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02]'
)

function measureIframeHeight(iframe: HTMLIFrameElement | null): number {
  if (!iframe?.contentDocument?.documentElement) return 420
  const doc = iframe.contentDocument
  const wrap = doc.getElementById('preview-wrap')
  const heights = [
    wrap?.scrollHeight,
    wrap?.offsetHeight,
    doc.body?.scrollHeight,
    doc.documentElement.scrollHeight
  ].filter((value): value is number => typeof value === 'number' && value > 0)
  return Math.max(...heights, 420)
}

function onModalIframeLoad() {
  const iframe = modalIframeRef.value
  if (!iframe) return
  iframe.style.height = `${measureIframeHeight(iframe)}px`
}

function openPreviewModal() {
  if (!hasHtml.value) return
  previewModalOpen.value = true
}

function closePreviewModal() {
  previewModalOpen.value = false
}

let escListener: ((e: KeyboardEvent) => void) | null = null

watch(previewModalOpen, (open) => {
  if (!import.meta.client) return
  if (escListener) {
    window.removeEventListener('keydown', escListener)
    escListener = null
  }
  if (open) {
    escListener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePreviewModal()
    }
    window.addEventListener('keydown', escListener)
    nextTick(() => onModalIframeLoad())
  }
})

watch(
  () => props.html,
  () => {
    if (!import.meta.client || !previewModalOpen.value) return
    nextTick(() => onModalIframeLoad())
  }
)

onBeforeUnmount(() => {
  if (!import.meta.client) return
  if (escListener) {
    window.removeEventListener('keydown', escListener)
    escListener = null
  }
})
</script>

<template>
  <div v-if="hasHtml" :class="rootClass">
    <div
      class="flex flex-col gap-3 border-b border-slate-100 bg-white px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-5"
      :class="{ 'sm:px-6': embedded }"
    >
      <div class="min-w-0 flex-1">
        <h3 class="text-base font-semibold text-slate-900">{{ title }}</h3>
        <p v-if="summary" class="mt-1 text-sm leading-relaxed text-slate-500">{{ summary }}</p>
        <p v-if="subject?.trim()" class="mt-1 line-clamp-2 text-sm text-slate-600 sm:truncate" :title="subjectDisplay">
          Subject: {{ subjectDisplay }}
        </p>
      </div>
      <div class="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:min-w-[11rem] sm:flex-row sm:flex-wrap sm:items-stretch sm:justify-end">
        <slot name="actions" />
        <button
          type="button"
          class="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] transition-colors hover:border-indigo-200 hover:bg-indigo-50/80 hover:text-indigo-800 sm:w-auto"
          @click="openPreviewModal"
        >
          <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
          Full preview
        </button>
      </div>
    </div>

    <button
      type="button"
      class="group relative block w-full overflow-hidden bg-[#f8f4ef] text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
      :aria-label="'Open full email preview. Subject: ' + subjectDisplay"
      @click="openPreviewModal"
    >
      <div class="relative aspect-[5/4] min-h-[12rem] w-full sm:aspect-[3/2] sm:min-h-[15rem]">
        <TenantEmailTemplateThumbnail
          :html="thumbnailSource"
          :title="title"
          class="absolute inset-0"
        />
        <div
          class="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#f8f4ef] via-[#f8f4ef]/95 to-transparent sm:h-24"
          aria-hidden="true"
        />
        <span
          class="pointer-events-none absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500 transition-colors group-hover:text-indigo-600 sm:bottom-4 sm:text-sm"
        >
          <svg class="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          Tap to open full preview
        </span>
      </div>
    </button>

    <slot name="footer" />
  </div>

  <p v-else class="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-500">
    {{ emptyMessage }}
  </p>

  <Teleport to="body">
    <div
      v-if="previewModalOpen && hasHtml"
      class="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4 lg:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="campaign-email-preview-modal-title"
    >
      <div
        class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        aria-hidden="true"
        @click="closePreviewModal"
      />
      <div
        class="relative flex h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/20 ring-1 ring-slate-900/[0.04] sm:h-[92vh] sm:rounded-2xl"
        @click.stop
      >
        <div class="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
          <div class="min-w-0">
            <p id="campaign-email-preview-modal-title" class="text-base font-semibold text-slate-900 sm:text-lg">
              {{ title }}
            </p>
            <p class="mt-1 line-clamp-2 text-sm text-slate-600 sm:truncate sm:text-base" :title="subjectDisplay">
              Subject: {{ subjectDisplay }}
            </p>
          </div>
          <button
            type="button"
            class="shrink-0 rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close preview"
            @click="closePreviewModal"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain bg-[#f8f4ef] p-3 sm:p-4 lg:p-5">
          <iframe
            ref="modalIframeRef"
            :key="html"
            :srcdoc="srcdoc"
            class="mx-auto block w-full max-w-[600px] border-0"
            sandbox="allow-same-origin"
            scrolling="no"
            title="Email preview (full size)"
            @load="onModalIframeLoad"
          />
        </div>
      </div>
    </div>
  </Teleport>
</template>
