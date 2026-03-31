<script setup lang="ts">
export interface EmailTemplateItem {
  id: string
  name: string
  html: string
  /** Default subject from the saved template (optional for older callers). */
  subject?: string
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    templates: EmailTemplateItem[]
    pending?: boolean
    error?: string
  }>(),
  { pending: false, error: '' }
)

const emit = defineEmits<{
  'update:modelValue': [boolean]
  'select-template': [EmailTemplateItem]
  'create-from-scratch': []
}>()

function close() {
  emit('update:modelValue', false)
}

function previewSrcdoc(html: string, scale = 0.28) {
  return `<!DOCTYPE html><html><head><meta charset=utf-8><style>
*{box-sizing:border-box}
body{margin:0;padding:32px 16px;overflow:auto;background:linear-gradient(135deg,#f8f4ef 0%,#f0e8df 100%);min-height:100%;display:flex;justify-content:center;align-items:flex-start}
#preview-wrap{transform:scale(${scale});transform-origin:center top;width:600px}
</style></head><body><div id=preview-wrap>${html}</div></body></html>`
}

function onScratch() {
  emit('create-from-scratch')
}

function onPick(t: EmailTemplateItem) {
  emit('select-template', t)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.modelValue) {
    e.preventDefault()
    close()
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (!import.meta.client) return
    document.body.style.overflow = open ? 'hidden' : ''
  }
)

onMounted(() => {
  if (import.meta.client) {
    window.addEventListener('keydown', onKeydown)
  }
})

onUnmounted(() => {
  if (import.meta.client) {
    window.removeEventListener('keydown', onKeydown)
    document.body.style.overflow = ''
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      leave-active-class="transition-opacity duration-150 ease-in"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-templates-modal-title"
      >
        <button
          type="button"
          class="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
          aria-label="Close"
          @click="close"
        />
        <Transition
          enter-active-class="transition duration-200 ease-out"
          leave-active-class="transition duration-150 ease-in"
          enter-from-class="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          leave-to-class="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
        >
          <div
            class="relative z-[81] flex max-h-[min(92vh,900px)] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl"
          >
            <header class="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
              <div class="min-w-0">
                <h2 id="email-templates-modal-title" class="text-lg font-semibold text-slate-900 sm:text-xl">
                  Email design
                </h2>
                <p class="mt-1 text-sm text-slate-500">
                  Start from scratch or choose a saved template from your library.
                </p>
              </div>
              <button
                type="button"
                class="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                aria-label="Close"
                @click="close"
              >
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </header>

            <div class="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              <button
                type="button"
                class="mb-6 flex w-full items-start gap-4 rounded-xl border border-slate-200 bg-slate-50/80 px-5 py-4 text-left transition-colors hover:border-slate-300 hover:bg-white"
                @click="onScratch"
              >
                <div class="mt-0.5 rounded-xl bg-white p-2.5 shadow-sm ring-1 ring-slate-200/80">
                  <svg class="h-5 w-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <div class="text-base font-semibold text-slate-900">Create from scratch</div>
                  <div class="mt-0.5 text-sm text-slate-500">Open the email editor with a blank canvas</div>
                </div>
              </button>

              <h3 class="mb-3 text-base font-semibold text-slate-800">Saved templates</h3>

              <div v-if="pending" class="rounded-xl border border-slate-200 bg-slate-50 px-5 py-12 text-center text-base text-slate-500">
                Loading templates…
              </div>
              <div v-else-if="error" class="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-base text-red-700">
                {{ error }}
              </div>
              <div
                v-else-if="!templates.length"
                class="rounded-xl border border-slate-200 bg-slate-50 px-5 py-10 text-center text-base text-slate-600"
              >
                No saved templates yet. Use “Create from scratch” or add templates to your library elsewhere.
              </div>
              <div v-else class="grid gap-4 sm:grid-cols-2">
                <div
                  v-for="t in templates"
                  :key="t.id"
                  class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-200/40"
                >
                  <div class="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900 sm:text-base">
                    {{ t.name }}
                  </div>
                  <div class="relative min-h-[160px] overflow-hidden bg-[#f8f4ef] sm:min-h-[180px]">
                    <iframe
                      :srcdoc="previewSrcdoc(t.html, 0.28)"
                      :title="t.name"
                      class="pointer-events-none absolute inset-0 h-full w-full border-0"
                      sandbox="allow-same-origin"
                    />
                  </div>
                  <div class="p-4">
                    <button
                      type="button"
                      class="w-full rounded-lg bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-800 sm:text-base"
                      @click="onPick(t)"
                    >
                      Use this template
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
