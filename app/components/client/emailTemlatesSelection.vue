<script setup lang="ts">
import type { UploadedEmailDesignPayload } from '~~/shared/uploadedEmailDesign'
import { normalizeUploadedEmailHtml, readUploadedHtmlFile } from '~~/shared/utils/uploadedEmailHtml'
import { ensureEmailTemplateUnsubscribe } from '~~/shared/utils/ensureEmailTemplateUnsubscribe'
import { emailHtmlImageTag, parseInsertableImageUrl } from '~~/shared/utils/emailTemplateHtmlImages'
import { compressCustomMarketingImageFile } from '~/utils/compressCustomMarketingImage'

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
    /** When false, hides GrapesJS “create from scratch” entry point. */
    emailEditorEnabled?: boolean
  }>(),
  { pending: false, error: '', mergeTagHints: () => [], emailEditorEnabled: true }
)

const emit = defineEmits<{
  'update:modelValue': [boolean]
  'select-template': [EmailTemplateItem]
  'create-from-scratch': []
  'upload-html': [UploadedEmailDesignPayload]
}>()

const marketingApi = useTenantMarketingApi()
const {
  allowTenantInsertImage,
  loaded: tenantFlagsLoaded,
  loadDefaultCampaignSender
} = useDefaultCampaignSender()
const canInsertImage = computed(
  () => tenantFlagsLoaded.value && allowTenantInsertImage.value
)

const saveHtmlToLibrary = ref(false)
const uploadPasteHtml = ref('')
const uploadError = ref('')
const uploadPending = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const htmlTextareaRef = ref<HTMLTextAreaElement | null>(null)
const imageFileInputRef = ref<HTMLInputElement | null>(null)
const imageUrl = ref('')
const imageUploadError = ref('')
const imageUploadPending = ref(false)
const uploadDragOver = ref(false)
const uploadEditorOpen = ref(false)

function close() {
  emit('update:modelValue', false)
}

function editorPreviewSrcdoc(html: string) {
  const trimmed = html.trim()
  const body = trimmed
    ? trimmed
    : `<div style="display:flex;align-items:center;justify-content:center;min-height:240px;color:#94a3b8;font-family:system-ui,sans-serif;font-size:14px;text-align:center;padding:2rem">Paste or upload HTML to see a live preview</div>`
  return `<!DOCTYPE html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box}
body{margin:0;padding:0;overflow:auto;background:#f8f4ef;min-height:100%}
</style></head><body>${body}</body></html>`
}

const editorPreviewDoc = computed(() => editorPreviewSrcdoc(uploadPasteHtml.value))

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
  uploadEditorOpen.value = false
  saveHtmlToLibrary.value = false
  imageUrl.value = ''
  imageUploadError.value = ''
  imageUploadPending.value = false
  if (fileInputRef.value) fileInputRef.value.value = ''
  if (imageFileInputRef.value) imageFileInputRef.value.value = ''
}

function insertHtmlAtCursor(snippet: string) {
  const el = htmlTextareaRef.value
  const current = uploadPasteHtml.value
  if (!el) {
    uploadPasteHtml.value = current + snippet
    return
  }
  const start = el.selectionStart ?? current.length
  const end = el.selectionEnd ?? start
  uploadPasteHtml.value = current.slice(0, start) + snippet + current.slice(end)
  nextTick(() => {
    el.focus()
    const pos = start + snippet.length
    el.setSelectionRange(pos, pos)
  })
}

function openInsertImagePicker() {
  if (!canInsertImage.value || imageUploadPending.value || uploadPending.value) return
  imageUploadError.value = ''
  imageFileInputRef.value?.click()
}

async function onCampaignImageFile(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!canInsertImage.value || !file || imageUploadPending.value) return

  imageUploadPending.value = true
  imageUploadError.value = ''
  try {
    const dataUrl = await compressCustomMarketingImageFile(file)
    const uploaded = await marketingApi.uploadEmailTemplateImage({ dataUrl })
    const url = typeof uploaded?.url === 'string' ? uploaded.url.trim() : ''
    if (!url) throw new Error('Upload succeeded but no image link was returned.')
    insertHtmlAtCursor(emailHtmlImageTag(url))
  } catch (e: unknown) {
    const message =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message ?? '')
        : ''
    imageUploadError.value = message || (e instanceof Error ? e.message : 'Could not upload image')
  } finally {
    imageUploadPending.value = false
  }
}

function insertImageFromUrl() {
  if (!canInsertImage.value || imageUploadPending.value) return
  const url = parseInsertableImageUrl(imageUrl.value)
  if (!url) {
    imageUploadError.value = 'Enter an image link that starts with http:// or https://.'
    return
  }
  imageUploadError.value = ''
  insertHtmlAtCursor(emailHtmlImageTag(url))
  imageUrl.value = ''
}

function openUploadEditor() {
  uploadError.value = ''
  uploadEditorOpen.value = true
}

function closeUploadEditor() {
  uploadEditorOpen.value = false
  uploadError.value = ''
}

function applyUploadedHtml(html: string) {
  uploadError.value = ''
  const check = ensureEmailTemplateUnsubscribe(html)
  emit('upload-html', { html: check.html, saveToLibrary: saveHtmlToLibrary.value })
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
    uploadPasteHtml.value = await readUploadedHtmlFile(file)
    openUploadEditor()
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
    if (uploadEditorOpen.value) closeUploadEditor()
    else close()
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
  void loadDefaultCampaignSender()
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
        class="fixed inset-0 z-[80] flex p-0"
        :class="uploadEditorOpen ? 'flex-col' : 'items-end justify-center sm:items-center sm:p-6'"
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-templates-modal-title"
      >
        <button
          v-if="!uploadEditorOpen"
          type="button"
          class="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
          aria-label="Close"
          @click="close"
        />
        <Transition
          enter-active-class="transition duration-200 ease-out"
          leave-active-class="transition duration-150 ease-in"
          :enter-from-class="uploadEditorOpen ? 'opacity-0' : 'opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95'"
          :leave-to-class="uploadEditorOpen ? 'opacity-0' : 'opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95'"
        >
          <div
            v-if="modelValue"
            class="relative z-[81] flex flex-col overflow-hidden bg-white"
            :class="
              uploadEditorOpen
                ? 'h-[100dvh] w-full max-h-[100dvh]'
                : 'h-[min(92dvh,900px)] max-h-[min(92dvh,900px)] w-full max-w-7xl rounded-t-2xl border border-slate-200/90 shadow-2xl shadow-slate-900/10 ring-1 ring-slate-900/[0.04] sm:h-auto sm:max-h-[min(92dvh,900px)] sm:rounded-2xl'
            "
            @click.stop
          >
            <!-- Full-page HTML editor: code + preview -->
            <template v-if="uploadEditorOpen">
              <header class="flex shrink-0 flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
                <div class="flex min-w-0 items-center gap-2 sm:gap-3">
                  <button
                    type="button"
                    class="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                    @click="closeUploadEditor"
                  >
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                    </svg>
                    <span class="hidden sm:inline">Back</span>
                  </button>
                  <div class="min-w-0 flex-1 border-l border-slate-200 pl-2 sm:pl-3">
                    <h2 id="email-templates-modal-title" class="truncate text-base font-semibold text-slate-900 sm:text-lg">
                      Edit HTML
                    </h2>
                    <p class="text-xs text-slate-500 sm:text-sm">
                      <span class="sm:hidden">Edit code, preview below</span>
                      <span class="hidden sm:inline">Code on the left, live preview on the right</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    class="ml-auto inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 sm:hidden"
                    aria-label="Close"
                    @click="close"
                  >
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div class="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <label class="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200/80 bg-slate-50 px-3 py-2 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
                    <input
                      v-model="saveHtmlToLibrary"
                      type="checkbox"
                      class="h-4 w-4 shrink-0 rounded border-slate-300 text-primary-600 focus:ring-primary-500/30"
                    >
                    <span class="text-sm font-medium text-slate-700">Save to library</span>
                  </label>
                  <div class="flex gap-2">
                    <button
                      type="button"
                      class="hidden rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 sm:inline-flex"
                      aria-label="Close"
                      @click="close"
                    >
                      <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      class="flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none sm:rounded-lg sm:py-2"
                      :disabled="uploadPending || imageUploadPending || !uploadPasteHtml.trim()"
                      @click="onUploadFromPaste"
                    >
                      Use HTML
                    </button>
                  </div>
                </div>
              </header>

              <div class="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
                <!-- Code panel -->
                <section class="flex min-h-0 flex-1 flex-col border-b border-slate-200 lg:w-1/2 lg:border-b-0 lg:border-r">
                  <div class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
                    <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">HTML code</span>
                    <div class="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
                      <template v-if="canInsertImage">
                        <input
                          ref="imageFileInputRef"
                          type="file"
                          accept="image/png,image/jpeg,image/gif,image/webp"
                          class="sr-only"
                          :disabled="imageUploadPending || uploadPending"
                          @change="onCampaignImageFile"
                        >
                        <button
                          type="button"
                          class="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                          :disabled="imageUploadPending || uploadPending"
                          @click="openInsertImagePicker"
                        >
                          {{ imageUploadPending ? 'Uploading image…' : 'Insert image' }}
                        </button>
                        <input
                          v-model="imageUrl"
                          type="url"
                          inputmode="url"
                          placeholder="https://image-url"
                          aria-label="Image URL"
                          class="min-w-[10rem] flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20 sm:max-w-xs"
                          :disabled="imageUploadPending || uploadPending"
                          @keydown.enter.prevent="insertImageFromUrl"
                        >
                        <button
                          type="button"
                          class="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                          :disabled="imageUploadPending || uploadPending || !imageUrl.trim()"
                          @click="insertImageFromUrl"
                        >
                          Insert URL
                        </button>
                      </template>
                      <button
                        type="button"
                        class="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-200/60 hover:text-slate-800"
                        @click="uploadPasteHtml = ''; uploadError = ''"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <p v-if="imageUploadError" class="shrink-0 border-b border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700" role="alert">
                    {{ imageUploadError }}
                  </p>
                  <textarea
                    id="upload-paste-html"
                    ref="htmlTextareaRef"
                    v-model="uploadPasteHtml"
                    class="min-h-[min(36dvh,320px)] flex-1 resize-none border-0 bg-slate-950 px-3 py-3 font-mono text-[12px] leading-relaxed text-slate-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500/40 sm:px-4 sm:py-4 sm:text-[13px] lg:min-h-0"
                    placeholder="<!DOCTYPE html>&#10;<html>&#10;  …&#10;</html>"
                    spellcheck="false"
                    :disabled="uploadPending"
                  />
                  <div v-if="mergeTagHints.length" class="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-3">
                    <p class="text-xs font-medium text-slate-500">Available merge tags</p>
                    <ul class="mt-2 flex flex-wrap gap-1.5">
                      <li
                        v-for="tag in mergeTagHints"
                        :key="tag"
                        class="rounded-md bg-primary-50 px-2 py-0.5 font-mono text-[11px] text-primary-800 ring-1 ring-primary-100"
                      >
                        {{ tag }}
                      </li>
                    </ul>
                  </div>
                </section>

                <!-- Preview panel -->
                <section class="flex min-h-0 flex-1 flex-col lg:w-1/2">
                  <div class="flex shrink-0 items-center border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
                    <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">Preview</span>
                  </div>
                  <div class="relative min-h-[min(32dvh,280px)] flex-1 bg-[#f8f4ef] lg:min-h-0">
                    <iframe
                      :srcdoc="editorPreviewDoc"
                      title="HTML preview"
                      class="absolute inset-0 h-full w-full border-0"
                      sandbox="allow-same-origin"
                    />
                  </div>
                </section>
              </div>

              <footer
                v-if="uploadError"
                class="shrink-0 border-t border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 sm:px-6"
              >
                {{ uploadError }}
              </footer>
            </template>

            <!-- Default picker -->
            <template v-else>
              <div
                class="flex shrink-0 justify-center pt-2.5 sm:hidden"
                aria-hidden="true"
              >
                <span class="h-1 w-10 rounded-full bg-slate-200" />
              </div>
              <header class="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white px-4 py-4 sm:gap-4 sm:px-6 sm:py-5">
                <div class="min-w-0">
                  <p class="text-[11px] font-semibold uppercase tracking-wider text-primary-600 sm:text-xs">
                    Design
                  </p>
                  <h2 id="email-templates-modal-title" class="mt-0.5 text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
                    Email design
                  </h2>
                  <p class="mt-1 max-w-lg text-sm leading-relaxed text-slate-500">
                    Build in the editor, upload raw HTML, or pick a saved template.
                  </p>
                </div>
                <button
                  type="button"
                  class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 sm:h-auto sm:w-auto sm:border-0 sm:p-2"
                  aria-label="Close"
                  @click="close"
                >
                  <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </header>

              <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-pb-[max(2rem,env(safe-area-inset-bottom,0px))]">
                <!-- Get started -->
                <section class="border-b border-slate-100 px-4 py-5 sm:px-6 sm:py-6">
                  <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Get started
                    </h3>
                    <label class="flex shrink-0 cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200/80 bg-slate-50 px-3 py-2 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
                      <input
                        v-model="saveHtmlToLibrary"
                        type="checkbox"
                        class="h-4 w-4 shrink-0 rounded border-slate-300 text-primary-600 focus:ring-primary-500/30"
                      >
                      <span class="text-sm font-medium text-slate-700">
                        Save HTML to template library
                      </span>
                    </label>
                  </div>

                  <div class="mt-4 grid gap-3 sm:gap-4" :class="emailEditorEnabled ? 'lg:grid-cols-2' : ''">
                    <button
                      v-if="emailEditorEnabled"
                      type="button"
                      class="group flex w-full items-center gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 text-left shadow-sm shadow-slate-900/[0.03] ring-1 ring-slate-900/[0.02] transition-all hover:border-slate-300 hover:shadow-md hover:shadow-slate-900/[0.06] sm:gap-4 sm:p-5"
                      @click="onScratch"
                    >
                      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm sm:h-12 sm:w-12">
                        <svg class="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </div>
                      <div class="min-w-0 flex-1">
                        <div class="font-semibold text-slate-900">Create from scratch</div>
                        <p class="mt-0.5 text-sm text-slate-500">Open the email editor</p>
                      </div>
                      <svg class="hidden h-5 w-5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500 sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>

                    <div
                      class="rounded-2xl border border-dashed p-4 transition-colors sm:p-5"
                      :class="uploadDragOver ? 'border-primary-400 bg-primary-50/50' : 'border-slate-200/90 bg-slate-50/50'"
                      @dragover="onDragOver"
                      @dragleave="onDragLeave"
                      @drop="onDrop"
                    >
                      <div class="flex items-start gap-3">
                        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white shadow-sm sm:h-12 sm:w-12">
                          <svg class="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                          <div class="mt-3 flex flex-col gap-2 min-[400px]:flex-row min-[400px]:flex-wrap">
                            <button
                              type="button"
                              class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50 min-[400px]:w-auto min-[400px]:py-2"
                              :disabled="uploadPending"
                              @click="onBrowseClick"
                            >
                              {{ uploadPending ? 'Reading file…' : 'Choose file' }}
                            </button>
                            <button
                              type="button"
                              class="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 min-[400px]:w-auto min-[400px]:py-2"
                              @click="openUploadEditor"
                            >
                              Paste HTML
                            </button>
                          </div>
                          <p class="mt-2 hidden text-xs text-slate-400 min-[400px]:block">or drag and drop .html here</p>
                          <p v-if="uploadError && !uploadEditorOpen" class="mt-2 text-xs text-red-600">
                            {{ uploadError }}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <!-- Saved templates -->
                <section class="px-4 py-5 sm:px-6 sm:py-6">
                  <div class="flex items-baseline justify-between gap-3">
                    <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Saved templates
                    </h3>
                    <span v-if="!pending && templates.length" class="text-xs text-slate-400">
                      {{ templates.length }} {{ templates.length === 1 ? 'template' : 'templates' }}
                    </span>
                  </div>

                  <div v-if="pending" class="mt-4 flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-14 text-sm text-slate-500">
                    <svg class="h-5 w-5 animate-spin text-primary-600" fill="none" viewBox="0 0 24 24">
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
                  <div v-else class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                    <article
                      v-for="t in templates"
                      :key="t.id"
                      class="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm shadow-slate-900/[0.03] ring-1 ring-slate-900/[0.02] transition-all hover:border-primary-200/80 hover:shadow-md hover:shadow-slate-900/[0.06]"
                    >
                      <div class="border-b border-slate-100 px-3 py-2.5 sm:px-4 sm:py-3">
                        <h4 class="truncate text-sm font-semibold text-slate-900" :title="t.name">
                          {{ t.name }}
                        </h4>
                        <p v-if="t.subject" class="mt-0.5 truncate text-xs text-slate-500" :title="t.subject">
                          {{ t.subject }}
                        </p>
                      </div>
                      <div class="relative aspect-[4/3] overflow-hidden bg-[#f8f4ef]">
                        <TenantEmailTemplateThumbnail
                          :html="t.html"
                          :title="`${t.name} preview`"
                          class="absolute inset-0"
                        />
                        <div class="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#f8f4ef] to-transparent" />
                      </div>
                      <div class="p-3 pt-2">
                        <button
                          type="button"
                          class="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white transition-colors group-hover:bg-primary-600 hover:bg-primary-600"
                          @click="onPick(t)"
                        >
                          Use template
                        </button>
                      </div>
                    </article>
                  </div>
                  <!-- Extra mobile scroll room so the last Use template control clears the home indicator. -->
                  <div
                    class="h-[max(1.5rem,env(safe-area-inset-bottom,0px))] sm:hidden"
                    aria-hidden="true"
                  />
                </section>
              </div>
            </template>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
