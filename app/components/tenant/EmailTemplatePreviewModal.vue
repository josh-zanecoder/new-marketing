<script setup lang="ts">
import { Megaphone } from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
  name: string
  subject?: string
  html: string
  templateId?: string
}>()

const emit = defineEmits<{
  close: []
}>()

const campaignHref = computed(() =>
  props.templateId
    ? `/tenant/campaigns/add?templateId=${encodeURIComponent(props.templateId)}`
    : ''
)

function previewSrcdoc(html: string) {
  return `<!DOCTYPE html><html><head><meta charset=utf-8><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*,*::before,*::after{box-sizing:border-box}
html,body{height:100%;margin:0}
body{padding:16px 10px;overflow:auto;background:linear-gradient(135deg,#f8f4ef 0%,#f0e8df 100%);-webkit-overflow-scrolling:touch}
#preview-wrap{width:100%;max-width:600px;margin:0 auto}
#preview-wrap img{max-width:100%!important;height:auto!important}
#preview-wrap table{max-width:100%!important}
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
        class="relative flex max-h-[min(92dvh,900px)] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/25 ring-1 ring-slate-900/[0.04] sm:rounded-2xl"
        @click.stop
      >
        <div
          class="flex shrink-0 justify-center pt-2.5 sm:hidden"
          aria-hidden="true"
        >
          <span class="h-1 w-10 rounded-full bg-slate-200" />
        </div>
        <div class="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
          <div class="min-w-0 flex-1">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-indigo-600 sm:text-xs">
              Preview
            </p>
            <h2 id="email-template-preview-title" class="mt-0.5 truncate text-base font-semibold text-slate-900 sm:text-lg">
              {{ name || 'Email template' }}
            </h2>
            <p v-if="subject?.trim()" class="mt-1 line-clamp-2 text-xs text-slate-500 sm:line-clamp-1 sm:text-sm">
              <span class="font-medium text-slate-600">Subject:</span> {{ subject }}
            </p>
            <p v-else class="mt-1 text-xs italic text-slate-400 sm:text-sm">
              No default subject
            </p>
          </div>
          <button
            type="button"
            class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 sm:h-auto sm:w-auto sm:border-0 sm:bg-transparent sm:px-2 sm:py-1 sm:shadow-none"
            aria-label="Close preview"
            @click="emit('close')"
          >
            <svg class="h-5 w-5 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span class="hidden text-sm font-semibold text-slate-600 sm:inline">Close</span>
          </button>
        </div>
        <div class="min-h-0 flex-1 overflow-hidden bg-slate-100/80 p-3 sm:p-5">
          <iframe
            v-if="html.trim()"
            :srcdoc="previewSrcdoc(html)"
            title="Email template preview"
            class="mx-auto block h-full min-h-[min(55dvh,640px)] w-full max-w-[600px] rounded-xl border border-slate-200/90 bg-white shadow-sm shadow-slate-900/[0.04]"
            sandbox="allow-same-origin"
          />
          <p v-else class="flex min-h-[min(40dvh,320px)] items-center justify-center px-4 text-center text-sm text-slate-500">
            This template has no HTML content.
          </p>
        </div>
        <div
          class="flex shrink-0 flex-col gap-2 border-t border-slate-100 bg-white px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] sm:flex-row sm:justify-end sm:gap-3 sm:px-6 sm:pb-4"
        >
          <NuxtLink
            v-if="campaignHref"
            :to="campaignHref"
            class="inline-flex w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 transition-colors hover:bg-indigo-700 sm:order-2 sm:w-auto"
            @click="emit('close')"
          >
            <Megaphone class="h-4 w-4 shrink-0" aria-hidden="true" />
            Make campaign
          </NuxtLink>
          <button
            type="button"
            class="inline-flex w-full items-center justify-center whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 sm:order-1 sm:w-auto"
            @click="emit('close')"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
