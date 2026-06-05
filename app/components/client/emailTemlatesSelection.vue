<script setup lang="ts">
import type { UploadedEmailDesignPayload } from '~~/shared/uploadedEmailDesign'
import { normalizeUploadedEmailHtml, readUploadedHtmlFile } from '~~/shared/utils/uploadedEmailHtml'

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
    /** Example merge tokens for upload hint */
    mergeTagHints?: string[]
  }>(),
  { pending: false, error: '', mergeTagHints: () => [] }
)

const emit = defineEmits<{
  'update:modelValue': [boolean]
  'select-template': [EmailTemplateItem]
  'create-from-scratch': []
  'upload-html': [UploadedEmailDesignPayload]
}>()

const saveHtmlToLibrary = ref(true)
const uploadPasteHtml = ref('')
const uploadError = ref('')
const uploadPending = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const uploadDragOver = ref(false)
const pasteSectionOpen = ref(false)

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

function resetUploadForm() {
  uploadPasteHtml.value = ''
  uploadError.value = ''
  uploadPending.value = false
  uploadDragOver.value = false
  pasteSectionOpen.value = false
  saveHtmlToLibrary.value = true
  if (fileInputRef.value) fileInputRef.value.value = ''
}

function openPasteSection() {
  uploadError.value = ''
  pasteSectionOpen.value = true
}

function closePasteSection() {
  pasteSectionOpen.value = false
  uploadError.value = ''
}

function applyUploadedHtml(html: string) {
  uploadError.value = ''
  emit('upload-html', { html, saveToLibrary: saveHtmlToLibrary.value })
  resetUploadForm()
}

function onUploadFromPaste() {
  uploadError.value = ''
  try {
    applyUploadedHtml(normalizeUploadedEmailHtml(uploadPasteHtml.value))
  } catch (e) {
    uploadError.value = e instanceof Error ? e.message : 'Invalid HTML'
  }
}

async function ingestFile(file: File) {
  uploadError.value = ''
  uploadPending.value = true
  try {
    applyUploadedHtml(await readUploadedHtmlFile(file))
  } catch (e) {
    uploadError.value = e instanceof Error ? e.message : 'Could not read file'
  } finally {
    uploadPending.value = false
    if (fileInputRef.value) fileInputRef.value.value = ''
  }
}

async function onFileChange(ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0]
  if (file) await ingestFile(file)
}

function onBrowseClick() {
  fileInputRef.value?.click()
}

function onDragOver(ev: DragEvent) {
  ev.preventDefault()
  uploadDragOver.value = true
}

function onDragLeave() {
  uploadDragOver.value = false
}

async function onDrop(ev: DragEvent) {
  ev.preventDefault()
  uploadDragOver.value = false
  const file = ev.dataTransfer?.files?.[0]
  if (file) await ingestFile(file)
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
    if (!open) resetUploadForm()
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
            v-if="modelValue"
            class="relative z-[81] flex max-h-[min(92vh,900px)] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border border-slate-200/90 bg-white shadow-2xl shadow-slate-900/10 ring-1 ring-slate-900/[0.04] sm:rounded-2xl"
          >
            <header class="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white px-5 py-5 sm:px-6">
              <div class="min-w-0">
                <h2 id="email-templates-modal-title" class="text-xl font-semibold tracking-tight text-slate-900">
                  Email design
                </h2>
                <p class="mt-1 max-w-lg text-sm leading-relaxed text-slate-500">
                  Build in the editor, upload raw HTML, or pick a saved template.
                </p>
              </div>
              <button
                type="button"
                class="shrink-0 rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                aria-label="Close"
                @click="close"
              >
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </header>

            <div class="min-h-0 flex-1 overflow-y-auto">
              <!-- Get started -->
              <section class="border-b border-slate-100 px-5 py-6 sm:px-6">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Get started
                  </h3>
                  <label class="flex shrink-0 cursor-pointer items-center gap-2.5">
                    <input
                      v-model="saveHtmlToLibrary"
                      type="checkbox"
                      class="h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/30"
                    >
                    <span class="text-sm font-medium text-slate-700">
                      Save HTML to template library
                    </span>
                  </label>
                </div>

                <div class="mt-4 grid gap-4 lg:grid-cols-2">
                  <button
                    type="button"
                    class="group flex w-full items-center gap-4 rounded-2xl border border-slate-200/90 bg-white p-5 text-left shadow-sm shadow-slate-900/[0.03] ring-1 ring-slate-900/[0.02] transition-all hover:border-slate-300 hover:shadow-md hover:shadow-slate-900/[0.06]"
                    @click="onScratch"
                  >
                    <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
                      <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="font-semibold text-slate-900">Create from scratch</div>
                      <p class="mt-0.5 text-sm text-slate-500">Open the GrapesJS email editor</p>
                    </div>
                    <svg class="h-5 w-5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  <div
                    class="rounded-2xl border border-dashed p-5 transition-colors"
                    :class="uploadDragOver ? 'border-indigo-400 bg-indigo-50/50' : 'border-slate-200/90 bg-slate-50/50'"
                    @dragover="onDragOver"
                    @dragleave="onDragLeave"
                    @drop="onDrop"
                  >
                    <div class="flex items-start gap-3">
                      <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
                        <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                      </div>
                      <div class="min-w-0 flex-1">
                        <div class="font-semibold text-slate-900">Upload HTML file</div>
                        <p class="mt-0.5 text-sm leading-snug text-slate-500">
                          Stored exactly as uploaded — not processed by the editor.
                        </p>
                        <input
                          ref="fileInputRef"
                          type="file"
                          accept=".html,.htm,text/html"
                          class="sr-only"
                          :disabled="uploadPending"
                          @change="onFileChange"
                        >
                        <div class="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                            :disabled="uploadPending"
                            @click="onBrowseClick"
                          >
                            {{ uploadPending ? 'Reading file…' : 'Choose file' }}
                          </button>
                          <button
                            v-if="!pasteSectionOpen"
                            type="button"
                            class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                            @click="openPasteSection"
                          >
                            Paste HTML
                          </button>
                        </div>
                        <p class="mt-2 text-xs text-slate-400">or drag and drop .html here</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  v-if="pasteSectionOpen"
                  class="mt-5 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm shadow-slate-900/[0.03] ring-1 ring-slate-900/[0.02] sm:p-5"
                >
                  <div class="flex items-start justify-between gap-3">
                    <label class="block text-sm font-medium text-slate-800" for="upload-paste-html">
                      Paste HTML
                    </label>
                    <button
                      type="button"
                      class="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      @click="closePasteSection"
                    >
                      Close
                    </button>
                  </div>
                  <p class="mt-0.5 text-xs text-slate-500">
                    Full document or body fragment — merge tags are replaced when the campaign sends.
                  </p>
                  <textarea
                    id="upload-paste-html"
                    v-model="uploadPasteHtml"
                    rows="5"
                    class="mt-3 w-full resize-y rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-3 font-mono text-xs leading-relaxed text-slate-800 transition-colors focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="<!DOCTYPE html>…"
                    :disabled="uploadPending"
                  />
                  <div v-if="mergeTagHints.length" class="mt-3">
                    <p class="text-xs font-medium text-slate-500">Available merge tags</p>
                    <ul class="mt-2 flex flex-wrap gap-1.5">
                      <li
                        v-for="tag in mergeTagHints"
                        :key="tag"
                        class="rounded-md bg-indigo-50 px-2 py-0.5 font-mono text-[11px] text-indigo-800 ring-1 ring-indigo-100"
                      >
                        {{ tag }}
                      </li>
                    </ul>
                  </div>
                  <p v-if="uploadError" class="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">
                    {{ uploadError }}
                  </p>
                  <div class="mt-4 flex flex-wrap items-center justify-end gap-3">
                    <button
                      type="button"
                      class="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                      @click="uploadPasteHtml = ''; uploadError = ''"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      class="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                      :disabled="uploadPending || !uploadPasteHtml.trim()"
                      @click="onUploadFromPaste"
                    >
                      Use pasted HTML
                    </button>
                  </div>
                </div>
              </section>

              <!-- Saved templates -->
              <section class="px-5 py-6 sm:px-6">
                <div class="flex items-baseline justify-between gap-3">
                  <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Saved templates
                  </h3>
                  <span v-if="!pending && templates.length" class="text-xs text-slate-400">
                    {{ templates.length }} {{ templates.length === 1 ? 'template' : 'templates' }}
                  </span>
                </div>

                <div v-if="pending" class="mt-4 flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-14 text-sm text-slate-500">
                  <svg class="h-5 w-5 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading templates…
                </div>
                <div v-else-if="error" class="mt-4 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
                  {{ error }}
                </div>
                <div
                  v-else-if="!templates.length"
                  class="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-12 text-center"
                >
                  <p class="text-sm font-medium text-slate-700">No saved templates yet</p>
                  <p class="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                    Upload HTML, create from scratch, or sync templates from your library.
                  </p>
                </div>
                <div v-else class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <article
                    v-for="t in templates"
                    :key="t.id"
                    class="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm shadow-slate-900/[0.03] ring-1 ring-slate-900/[0.02] transition-all hover:border-indigo-200/80 hover:shadow-md hover:shadow-slate-900/[0.06]"
                  >
                    <div class="border-b border-slate-100 px-4 py-3">
                      <h4 class="truncate text-sm font-semibold text-slate-900" :title="t.name">
                        {{ t.name }}
                      </h4>
                      <p v-if="t.subject" class="mt-0.5 truncate text-xs text-slate-500" :title="t.subject">
                        {{ t.subject }}
                      </p>
                    </div>
                    <div class="relative aspect-[4/3] overflow-hidden bg-[#f8f4ef]">
                      <iframe
                        :srcdoc="previewSrcdoc(t.html, 0.26)"
                        :title="`${t.name} preview`"
                        class="pointer-events-none absolute inset-0 h-full w-full border-0"
                        sandbox="allow-same-origin"
                      />
                      <div class="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#f8f4ef] to-transparent" />
                    </div>
                    <div class="p-3 pt-2">
                      <button
                        type="button"
                        class="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white transition-colors group-hover:bg-indigo-600 hover:bg-indigo-600"
                        @click="onPick(t)"
                      >
                        Use template
                      </button>
                    </div>
                  </article>
                </div>
              </section>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
