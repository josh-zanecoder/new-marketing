<script setup lang="ts">
const props = defineProps<{
  open: boolean
  name: string
  subject?: string
  html: string
}>()

const emit = defineEmits<{
  close: []
}>()

function previewSrcdoc(html: string, scale = 0.82) {
  return `<!DOCTYPE html><html><head><meta charset=utf-8><style>
*{box-sizing:border-box}
body{margin:0;padding:24px 12px;overflow:auto;background:linear-gradient(135deg,#f8f4ef 0%,#f0e8df 100%);min-height:100%;display:flex;justify-content:center;align-items:flex-start}
#preview-wrap{transform:scale(${scale});transform-origin:top center;width:520px;max-width:100%}
</style></head><body><div id=preview-wrap>${html}</div></body></html>`
}

let escListener: ((e: KeyboardEvent) => void) | null = null

watch(
  () => props.open,
  (open) => {
    if (!import.meta.client) return
    document.body.style.overflow = open ? 'hidden' : ''
    if (escListener) {
      window.removeEventListener('keydown', escListener)
      escListener = null
    }
    if (open) {
      escListener = (e: KeyboardEvent) => {
        if (e.key === 'Escape') emit('close')
      }
      window.addEventListener('keydown', escListener)
    }
  }
)

onBeforeUnmount(() => {
  if (!import.meta.client) return
  document.body.style.overflow = ''
  if (escListener) {
    window.removeEventListener('keydown', escListener)
    escListener = null
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="name ? 'email-template-preview-title' : undefined"
    >
      <div
        class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        aria-hidden="true"
        @click="emit('close')"
      />
      <div
        class="relative flex max-h-[min(92vh,900px)] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/25 ring-1 ring-slate-900/[0.04] sm:rounded-2xl"
      >
        <div class="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div class="min-w-0">
            <h2 id="email-template-preview-title" class="truncate text-lg font-semibold text-slate-900">
              {{ name || 'Email template' }}
            </h2>
            <p v-if="subject?.trim()" class="mt-1 truncate text-sm text-slate-500">
              Subject: {{ subject }}
            </p>
          </div>
          <button
            type="button"
            class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
            aria-label="Close preview"
            @click="emit('close')"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="min-h-0 flex-1 overflow-auto bg-slate-100/80 p-4 sm:p-6">
          <iframe
            v-if="html.trim()"
            :srcdoc="previewSrcdoc(html, 0.82)"
            title="Email template preview"
            class="mx-auto block min-h-[420px] w-full max-w-[520px] rounded-xl border border-slate-200/90 bg-white shadow-sm"
            sandbox="allow-same-origin"
          />
          <p v-else class="py-16 text-center text-sm text-slate-500">
            This template has no HTML content.
          </p>
        </div>
      </div>
    </div>
  </Teleport>
</template>
