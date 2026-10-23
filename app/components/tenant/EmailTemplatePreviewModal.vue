<script setup lang="ts">
import { Megaphone, Monitor, Smartphone, X } from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
  name: string
  subject?: string
  html: string
  templateId?: string
  /** Stack above other dialogs (e.g. unsubscribe footer notice at z-200). */
  elevated?: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const overlayZClass = computed(() => (props.elevated ? 'z-[210]' : 'z-[100]'))

const view = ref<'desktop' | 'mobile'>('desktop')

const campaignHref = computed(() =>
  props.templateId
    ? `/tenant/campaigns/add?templateId=${encodeURIComponent(props.templateId)}`
    : ''
)

function previewSrcdoc(html: string) {
  return `<!DOCTYPE html><html><head><meta charset=utf-8><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;background:#ffffff}
body{overflow:auto;-webkit-overflow-scrolling:touch}
img{max-width:100%!important;height:auto!important}
table{max-width:100%!important}
</style></head><body>${html}</body></html>`
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
      view.value = 'desktop'
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
      class="fixed inset-0 flex items-end justify-center sm:items-center sm:p-6"
      :class="overlayZClass"
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
        class="relative flex h-[min(96dvh,1040px)] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/25 ring-1 ring-slate-900/[0.04] sm:rounded-2xl"
        @click.stop
      >
        <div
          class="flex shrink-0 justify-center pt-2.5 sm:hidden"
          aria-hidden="true"
        >
          <span class="h-1 w-10 rounded-full bg-slate-200" />
        </div>
        <div class="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <div class="min-w-0">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-primary-600">
              Preview
            </p>
            <h2 id="email-template-preview-title" class="truncate text-base font-semibold text-slate-900">
              {{ name || 'Email template' }}
            </h2>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <div class="flex rounded-full bg-slate-100 p-0.5" role="radiogroup" aria-label="Preview width">
              <button
                type="button"
                class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold"
                :class="view === 'desktop' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'"
                @click="view = 'desktop'"
              >
                <Monitor class="h-3.5 w-3.5" aria-hidden="true" />
                <span class="hidden sm:inline">Desktop</span>
              </button>
              <button
                type="button"
                class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold"
                :class="view === 'mobile' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'"
                @click="view = 'mobile'"
              >
                <Smartphone class="h-3.5 w-3.5" aria-hidden="true" />
                <span class="hidden sm:inline">Phone</span>
              </button>
            </div>
            <button
              type="button"
              class="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
              aria-label="Close preview"
              @click="emit('close')"
            >
              <X class="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div class="shrink-0 border-b border-slate-100 bg-slate-50 px-4 py-3 sm:px-5">
          <p class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Subject
          </p>
          <p v-if="subject?.trim()" class="mt-0.5 text-sm font-medium text-slate-900">
            {{ subject }}
          </p>
          <p v-else class="mt-0.5 text-sm italic text-slate-400">
            No default subject
          </p>
        </div>
        <div class="flex min-h-0 flex-1 justify-center overflow-hidden bg-slate-200/70 p-3 sm:p-6">
          <iframe
            v-if="html.trim()"
            :srcdoc="previewSrcdoc(html)"
            title="Email template preview"
            class="h-full rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-900/10 transition-[width] duration-200"
            :class="view === 'mobile' ? 'w-[390px] max-w-full' : 'w-full max-w-[680px]'"
            sandbox="allow-same-origin"
          />
          <p v-else class="flex items-center justify-center px-4 text-center text-sm text-slate-500">
            This template has no HTML content.
          </p>
        </div>
        <div
          class="flex shrink-0 flex-col gap-2 border-t border-slate-100 bg-white px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] sm:flex-row sm:justify-end sm:gap-3 sm:px-6 sm:pb-4"
        >
          <NuxtLink
            v-if="campaignHref"
            :to="campaignHref"
            class="inline-flex w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary-600/25 transition-colors hover:bg-primary-700 sm:order-2 sm:w-auto"
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
