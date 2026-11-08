<script setup lang="ts">
import { normalizeUploadedEmailHtml, readUploadedHtmlFile } from '~~/shared/utils/uploadedEmailHtml'
import { ensureEmailTemplateUnsubscribe } from '~~/shared/utils/ensureEmailTemplateUnsubscribe'
import type { TenantDynamicVariableItem, TenantEmailTemplateCategoryRow } from '~/composables/useTenantMarketingApi'
import { buildEmailTemplateCategoryAssignOptions } from '~~/shared/utils/emailTemplateCategory'
import {
  emailTemplateHtmlImageLabel,
  listEmailTemplateHtmlImages,
  replaceEmailTemplateHtmlImageSrc
} from '~~/shared/utils/emailTemplateHtmlImages'
import {
  fetchRemoteImageAsDataUrlInBrowser,
  hostUploadedEmailTemplateImages
} from '~~/shared/utils/hostUploadedEmailTemplateImages'
import { emailTemplateHtmlNeedsImageHosting } from '~~/shared/utils/emailTemplateHostableImages'
import type { TenantHostedImage } from '~~/shared/tenantHostedImages'

definePageMeta({ layout: 'default' })

const route = useRoute()
const marketingApi = useTenantMarketingApi()
const toast = useAppToast()
const {
  allowTenantLoRecipientLists,
  loadDefaultCampaignSender,
  loaded: loListsFlagLoaded
} = useDefaultCampaignSender()
void loadDefaultCampaignSender()
/** Superadmin LO recipient-list toggle gates template image insert/replace from Images library. */
const canUploadTemplateImage = computed(
  () => loListsFlagLoaded.value && allowTenantLoRecipientLists.value === true
)
const {

  open: unsubscribeFooterModalOpen,
  previewOpen: unsubscribeFooterPreviewOpen,
  previewHtml: unsubscribeFooterPreviewHtml,
  title: unsubscribeFooterModalTitle,
  message: unsubscribeFooterModalMessage,
  confirmText: unsubscribeFooterModalConfirm,
  previewText: unsubscribeFooterModalPreview,
  close: closeUnsubscribeFooterModal,
  openPreview: openUnsubscribeFooterPreview,
  closePreview: closeUnsubscribeFooterPreview,
  openIfAppended: openUnsubscribeFooterModalIfAppended
} = useUnsubscribeFooterAppendedModal()

const editTemplateId = computed(() => {
  const q = route.query.templateId
  const raw = Array.isArray(q) ? q[0] : q
  return typeof raw === 'string' ? raw.trim() : ''
})
const isEdit = computed(() => Boolean(editTemplateId.value && /^[a-f0-9]{24}$/i.test(editTemplateId.value)))

const name = ref('')
const subject = ref('')
const categoryId = ref('')
const categories = ref<TenantEmailTemplateCategoryRow[]>([])
const htmlContent = ref('')
const formError = ref('')
const approvalStatus = ref<string | null>(null)
const approvalReviewedBy = ref('')
const approvalRejectionReason = ref('')
const canApproveTemplate = ref(false)
const uploadError = ref('')
const uploadPending = ref(false)
const imageUploadError = ref('')
/** When set, picker selection replaces that `<img>` src instead of inserting. */
const replaceImageIndex = ref<number | null>(null)
const imagePickerOpen = ref(false)
const imagePickerMode = ref<'insert' | 'replace'>('insert')
const saving = ref(false)
const loading = ref(false)
const uploadDragOver = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const subjectInputRef = ref<HTMLInputElement | null>(null)
const htmlTextareaRef = ref<HTMLTextAreaElement | null>(null)
const lastFocusedField = ref<'subject' | 'html'>('html')

function emailTemplateImageSnippet(url: string): string {
  const src = url.replace(/"/g, '&quot;')
  return `<img src="${src}" alt="" width="600" style="display:block;max-width:100%;height:auto;border:0;" />`
}

const templateHtmlImages = computed(() => listEmailTemplateHtmlImages(htmlContent.value))
const showTemplateImageReplace = computed(
  () => canUploadTemplateImage.value && templateHtmlImages.value.length > 0
)
const anyImageBusy = computed(() => uploadPending.value)
const imagePickerTitle = computed(() =>
  imagePickerMode.value === 'replace' ? 'Replace with hosted image' : 'Insert hosted image'
)
const imagePickerConfirmText = computed(() =>
  imagePickerMode.value === 'replace' ? 'Replace image' : 'Insert image'
)

const categoryAssignOptions = computed(() =>
  buildEmailTemplateCategoryAssignOptions(
    categories.value.map((c) => ({ id: c.id, name: c.name }))
  )
)

const dynamicVariables = ref<TenantDynamicVariableItem[]>([])
const dynamicVariablesPending = ref(true)
const dynamicVariablesError = ref('')

function variableCategory(v: TenantDynamicVariableItem): 'Recipient variables' | 'User variables' {
  if (v.sourceType === 'user') return 'User variables'
  if (v.sourceType === 'recipient') return 'Recipient variables'
  if (/^user\./i.test(v.key)) return 'User variables'
  return 'Recipient variables'
}

const groupedDynamicVariables = computed(() => {
  const recipient: TenantDynamicVariableItem[] = []
  const user: TenantDynamicVariableItem[] = []
  for (const v of dynamicVariables.value) {
    if (v.enabled === false) continue
    if (variableCategory(v) === 'User variables') user.push(v)
    else recipient.push(v)
  }
  return { recipient, user }
})

const hasDynamicVariables = computed(
  () => groupedDynamicVariables.value.recipient.length > 0 || groupedDynamicVariables.value.user.length > 0
)

function tokenFor(v: TenantDynamicVariableItem) {
  return `{{${v.key}}}`
}

function scopeLabel(v: TenantDynamicVariableItem): string {
  const scopes = v.scopes ?? []
  if (!scopes.length) return 'Subject & body'
  if (scopes.includes('subject') && scopes.includes('body')) return 'Subject & body'
  if (scopes.includes('subject')) return 'Subject'
  return 'Body'
}

function insertAtCursor(
  el: HTMLInputElement | HTMLTextAreaElement | null,
  current: string,
  token: string,
  onUpdate: (next: string) => void
) {
  if (!el) {
    onUpdate(current + token)
    return
  }
  const start = el.selectionStart ?? current.length
  const end = el.selectionEnd ?? start
  const next = current.slice(0, start) + token + current.slice(end)
  onUpdate(next)
  nextTick(() => {
    el.focus()
    const pos = start + token.length
    el.setSelectionRange(pos, pos)
  })
}

function insertVariable(v: TenantDynamicVariableItem) {
  const token = tokenFor(v)
  if (lastFocusedField.value === 'subject') {
    insertAtCursor(subjectInputRef.value, subject.value, token, (next) => {
      subject.value = next
    })
  } else {
    insertAtCursor(htmlTextareaRef.value, htmlContent.value, token, (next) => {
      htmlContent.value = next
    })
  }
  toast.success(`Inserted ${token}`)
}

async function loadDynamicVariables() {
  dynamicVariablesPending.value = true
  dynamicVariablesError.value = ''
  try {
    const res = await marketingApi.fetchDynamicVariables()
    dynamicVariables.value = Array.isArray(res.variables) ? res.variables : []
  } catch {
    dynamicVariables.value = []
    dynamicVariablesError.value = 'Could not load dynamic variables.'
  } finally {
    dynamicVariablesPending.value = false
  }
}

function editorPreviewSrcdoc(html: string) {
  const trimmed = html.trim()
  if (!trimmed) {
    return `<!DOCTYPE html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body><div style="display:flex;align-items:center;justify-content:center;min-height:240px;color:#94a3b8;font-family:system-ui,sans-serif;font-size:14px;text-align:center;padding:2rem">Paste or upload HTML to see a live preview</div></body></html>`
  }
  // Full documents (with images) must not be nested inside another body.
  if (/^<!DOCTYPE/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) {
    return trimmed
  }
  return `<!DOCTYPE html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box}
body{margin:0;padding:0;overflow:auto;background:#f8f4ef;min-height:100%}
</style></head><body>${trimmed}</body></html>`
}

const previewDoc = computed(() => editorPreviewSrcdoc(htmlContent.value))

async function loadCategories() {
  try {
    const cached = readNuxtPayloadCache(TENANT_EMAIL_TEMPLATE_CATEGORIES_CACHE_KEY, useNuxtApp()) as
      | TenantEmailTemplateCategoryRow[]
      | undefined
    if (Array.isArray(cached)) {
      categories.value = cached
      return
    }
    const res = await marketingApi.fetchEmailTemplateCategories()
    categories.value = res.categories ?? []
    useNuxtApp().payload.data[TENANT_EMAIL_TEMPLATE_CATEGORIES_CACHE_KEY] = categories.value
  } catch {
    categories.value = []
  }
}

async function loadExistingTemplate() {
  if (!isEdit.value) return
  loading.value = true
  formError.value = ''
  try {
    const res = await marketingApi.fetchEmailTemplateById(editTemplateId.value)
    name.value = res.template.name?.trim() ?? ''
    subject.value = res.template.subject?.trim() ?? ''
    categoryId.value = res.template.categoryId?.trim() ?? ''
    htmlContent.value = res.template.htmlTemplate?.trim() ?? ''
    approvalStatus.value = res.template.approvalStatus ?? null
    approvalReviewedBy.value = res.template.approvalReviewedBy?.trim() ?? ''
    approvalRejectionReason.value = res.template.approvalRejectionReason?.trim() ?? ''
    canApproveTemplate.value = res.template.canApprove === true
  } catch {
    formError.value = 'Could not load this template.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadCategories()
  void loadDynamicVariables()
  void loadExistingTemplate()
})

watch(editTemplateId, () => {
  void loadExistingTemplate()
})

async function hostImagesInUploadedHtml(html: string): Promise<string> {
  if (!canUploadTemplateImage.value || !emailTemplateHtmlNeedsImageHosting(html)) {
    return html
  }
  const result = await hostUploadedEmailTemplateImages({
    html,
    uploadDataUrl: async (dataUrl) => {
      const uploaded = await marketingApi.uploadTenantHostedImage({ dataUrl })
      return String(uploaded?.url ?? '').trim()
    },
    fetchRemoteAsDataUrl: fetchRemoteImageAsDataUrlInBrowser
  })
  if (result.hostedCount > 0) {
    toast.success(
      result.hostedCount === 1
        ? '1 image uploaded to Images and linked in the template'
        : `${result.hostedCount} images uploaded to Images and linked in the template`
    )
  }
  if (result.failedCount > 0 || result.skippedUnsupportedCount > 0) {
    const bits: string[] = []
    if (result.failedCount > 0) {
      bits.push(`${result.failedCount} could not be hosted yet (will retry on save)`)
    }
    if (result.skippedUnsupportedCount > 0) {
      bits.push(`${result.skippedUnsupportedCount} relative/cid image(s) need manual Replace`)
    }
    imageUploadError.value = bits.join('. ')
  }
  return result.html
}

async function ingestFile(file: File) {
  uploadError.value = ''
  imageUploadError.value = ''
  uploadPending.value = true
  try {
    const check = ensureEmailTemplateUnsubscribe(await readUploadedHtmlFile(file))
    const hostedHtml = await hostImagesInUploadedHtml(check.html)
    const finalCheck = ensureEmailTemplateUnsubscribe(hostedHtml)
    htmlContent.value = finalCheck.html
    await openUnsubscribeFooterModalIfAppended(
      check.footerAppended || finalCheck.footerAppended,
      finalCheck.html
    )
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

function openInsertImagePicker() {
  if (!canUploadTemplateImage.value || anyImageBusy.value) return
  imageUploadError.value = ''
  replaceImageIndex.value = null
  imagePickerMode.value = 'insert'
  imagePickerOpen.value = true
}

function openReplaceImagePicker(index: number) {
  if (!canUploadTemplateImage.value || anyImageBusy.value) return
  imageUploadError.value = ''
  replaceImageIndex.value = index
  imagePickerMode.value = 'replace'
  imagePickerOpen.value = true
}

function closeImagePicker() {
  imagePickerOpen.value = false
  if (imagePickerMode.value === 'replace') {
    replaceImageIndex.value = null
  }
}

function onHostedImagePicked(item: TenantHostedImage) {
  const url = item.url?.trim()
  if (!url) {
    imageUploadError.value = 'Selected image has no hosted link'
    closeImagePicker()
    return
  }

  lastFocusedField.value = 'html'
  imageUploadError.value = ''
  uploadError.value = ''

  if (imagePickerMode.value === 'replace') {
    const index = replaceImageIndex.value
    imagePickerOpen.value = false
    replaceImageIndex.value = null
    if (index == null || index < 0) return
    const next = replaceEmailTemplateHtmlImageSrc(htmlContent.value, index, url)
    if (next === htmlContent.value) {
      imageUploadError.value = 'Could not find that image in the HTML anymore. Try again.'
      return
    }
    htmlContent.value = next
    toast.success(`Image ${index + 1} replaced`)
    return
  }

  imagePickerOpen.value = false
  const snippet = emailTemplateImageSnippet(url)
  insertAtCursor(htmlTextareaRef.value, htmlContent.value, snippet, (next) => {
    htmlContent.value = next
  })
  toast.success('Image inserted into HTML')
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

async function validatePasteHtml() {
  uploadError.value = ''
  try {
    const check = ensureEmailTemplateUnsubscribe(normalizeUploadedEmailHtml(htmlContent.value))
    htmlContent.value = check.html
    await openUnsubscribeFooterModalIfAppended(check.footerAppended, check.html)
  } catch (e) {
    uploadError.value = e instanceof Error ? e.message : 'Invalid HTML'
  }
}

async function saveTemplate() {
  formError.value = ''
  uploadError.value = ''

  const trimmedName = name.value.trim()
  const trimmedSubject = subject.value.trim()
  if (!trimmedName) {
    formError.value = 'Template name is required.'
    return
  }
  if (!trimmedSubject) {
    formError.value = 'Default subject is required.'
    return
  }

  let html = ''
  try {
    const check = ensureEmailTemplateUnsubscribe(normalizeUploadedEmailHtml(htmlContent.value))
    html = check.html
    htmlContent.value = html
    await openUnsubscribeFooterModalIfAppended(check.footerAppended, check.html)
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'HTML is required.'
    return
  }

  saving.value = true
  try {
    const resolvedCategoryId = categoryId.value.trim() || null
    if (isEdit.value) {
      const updated = await marketingApi.updateEmailTemplate(editTemplateId.value, {
        name: trimmedName,
        subject: trimmedSubject,
        htmlTemplate: html,
        htmlSource: 'upload',
        saveToLibrary: true,
        categoryId: resolvedCategoryId
      })
      const hostedOnSave = Number((updated as { imagesHostedCount?: number })?.imagesHostedCount ?? 0)
      if (hostedOnSave > 0) {
        toast.success(
          hostedOnSave === 1
            ? 'Saved — 1 image hosted in Images'
            : `Saved — ${hostedOnSave} images hosted in Images`
        )
      }
    } else {
      const created = await marketingApi.createEmailTemplate({
        name: trimmedName,
        subject: trimmedSubject,
        htmlTemplate: html,
        htmlSource: 'upload',
        saveToLibrary: true,
        categoryId: resolvedCategoryId
      })
      const hostedOnSave = Number((created as { imagesHostedCount?: number })?.imagesHostedCount ?? 0)
      if (hostedOnSave > 0) {
        toast.success(
          hostedOnSave === 1
            ? 'Saved — 1 image hosted in Images'
            : `Saved — ${hostedOnSave} images hosted in Images`
        )
      }
    }
    clearNuxtPayloadCache(TENANT_EMAIL_TEMPLATES_INDEX_CACHE_KEY)
    await navigateTo('/tenant/email-templates')
  } catch {
    formError.value = 'Failed to save template. Please try again.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-7xl space-y-6">
    <header>
      <NuxtLink
        to="/tenant/email-templates"
        class="text-sm font-medium text-primary-600 hover:text-primary-700"
      >
        ← Back to templates
      </NuxtLink>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <h1 class="text-2xl font-semibold tracking-tight text-slate-900">
          {{ isEdit ? 'Edit email template' : 'Create email template' }}
        </h1>
        <TenantEmailTemplateApprovalBadge
          v-if="canUploadTemplateImage && isEdit"
          :status="approvalStatus"
        />
      </div>
      <p class="mt-2 text-sm text-slate-500">
        Paste HTML or upload an .html file. The template is stored exactly as provided.
      </p>
      <p
        v-if="canUploadTemplateImage && isEdit && approvalStatus === 'rejected'"
        class="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
        role="status"
      >
        <span v-if="approvalReviewedBy">Rejected by {{ approvalReviewedBy }}.</span>
        <span v-else>Rejected.</span>
        <span v-if="approvalRejectionReason"> {{ approvalRejectionReason }}</span>
      </p>
      <p
        v-else-if="canUploadTemplateImage && isEdit && approvalStatus === 'pending_approval'"
        class="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
        role="status"
      >
        Waiting for Operations Manager or Marketing approval before this template can be sent.
      </p>
      <p
        v-else-if="canUploadTemplateImage && isEdit && approvalStatus === 'approved' && approvalReviewedBy"
        class="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950"
        role="status"
      >
        Approved by {{ approvalReviewedBy }}
      </p>
      <div
        v-if="canUploadTemplateImage && isEdit && canApproveTemplate && approvalStatus === 'pending_approval'"
        class="mt-3 flex flex-wrap gap-2"
      >
        <NuxtLink
          to="/tenant/email-templates/approvals"
          class="inline-flex items-center rounded-xl bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
        >
          Review in approvals
        </NuxtLink>
      </div>
    </header>

    <div v-if="loading" class="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-16">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-primary-600" />
    </div>

    <form
      v-else
      class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_17.5rem] xl:items-start"
      @submit.prevent="saveTemplate"
    >
      <aside
        class="min-w-0 rounded-2xl border border-slate-200/80 bg-white shadow-sm xl:col-start-2 xl:row-start-1 xl:sticky xl:top-6 xl:max-h-[calc(100dvh-7rem)] xl:overflow-y-auto"
        aria-label="Dynamic variables"
      >
        <div class="border-b border-slate-100 px-4 py-4">
          <h2 class="text-sm font-semibold text-slate-900">Dynamic variables</h2>
          <p class="mt-1 text-xs leading-relaxed text-slate-500">
            Click a variable to insert <span v-pre class="font-mono text-[11px] text-slate-600">{{key}}</span> into the focused field (subject or HTML).
          </p>
        </div>

        <div v-if="dynamicVariablesPending" class="flex items-center justify-center px-4 py-10">
          <div class="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-primary-600" />
        </div>

        <div v-else-if="dynamicVariablesError" class="px-4 py-6 text-sm text-red-600">
          {{ dynamicVariablesError }}
        </div>

        <div v-else-if="!hasDynamicVariables" class="px-4 py-6 text-sm text-slate-500">
          No dynamic variables configured for this tenant.
        </div>

        <div v-else class="space-y-5 px-3 py-4">
          <section v-if="groupedDynamicVariables.recipient.length">
            <h3 class="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Recipient
            </h3>
            <ul class="mt-2 space-y-1">
              <li v-for="v in groupedDynamicVariables.recipient" :key="v.id ?? v.key">
                <button
                  type="button"
                  class="group flex w-full flex-col rounded-xl border border-transparent px-3 py-2.5 text-left transition-colors hover:border-primary-100 hover:bg-primary-50/60"
                  @click="insertVariable(v)"
                >
                  <span class="text-sm font-medium text-slate-800 group-hover:text-primary-900">
                    {{ v.label || v.key }}
                  </span>
                  <span class="mt-0.5 font-mono text-[11px] text-primary-700/90">{{ tokenFor(v) }}</span>
                  <span class="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                    {{ scopeLabel(v) }}
                  </span>
                </button>
              </li>
            </ul>
          </section>

          <section v-if="groupedDynamicVariables.user.length">
            <h3 class="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              User
            </h3>
            <ul class="mt-2 space-y-1">
              <li v-for="v in groupedDynamicVariables.user" :key="v.id ?? v.key">
                <button
                  type="button"
                  class="group flex w-full flex-col rounded-xl border border-transparent px-3 py-2.5 text-left transition-colors hover:border-primary-100 hover:bg-primary-50/60"
                  @click="insertVariable(v)"
                >
                  <span class="text-sm font-medium text-slate-800 group-hover:text-primary-900">
                    {{ v.label || v.key }}
                  </span>
                  <span class="mt-0.5 font-mono text-[11px] text-primary-700/90">{{ tokenFor(v) }}</span>
                  <span class="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                    {{ scopeLabel(v) }}
                  </span>
                </button>
              </li>
            </ul>
          </section>
        </div>
      </aside>

      <div class="min-w-0 space-y-5 xl:col-start-1 xl:row-start-1">
      <div class="grid gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:grid-cols-2 sm:p-6">
        <div>
          <label class="block text-sm font-medium text-slate-700" for="template-name">Template name</label>
          <input
            id="template-name"
            v-model="name"
            type="text"
            required
            placeholder="e.g. Monthly newsletter"
            class="mt-1.5 w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-primary-300 focus:outline-none focus:ring-[3px] focus:ring-primary-500/20"
          >
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700" for="template-subject">Default subject</label>
          <input
            id="template-subject"
            ref="subjectInputRef"
            v-model="subject"
            type="text"
            required
            placeholder="e.g. Your monthly update"
            class="mt-1.5 w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-primary-300 focus:outline-none focus:ring-[3px] focus:ring-primary-500/20"
            @focus="lastFocusedField = 'subject'"
          >
        </div>
        <div class="sm:col-span-2">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <label class="block text-sm font-medium text-slate-700" for="template-category">Category</label>
            <NuxtLink
              to="/tenant/email-templates/categories"
              class="text-xs font-semibold text-primary-600 hover:text-primary-700"
            >
              Manage categories
            </NuxtLink>
          </div>
          <TenantFilterSelect
            id="template-category"
            v-model="categoryId"
            label="Category"
            variant="field"
            :options="categoryAssignOptions"
            class="mt-1.5"
          />
        </div>
      </div>

      <div class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div
          class="border-b border-slate-100 px-4 py-4 sm:px-6"
          :class="uploadDragOver ? 'bg-primary-50/50' : 'bg-slate-50/80'"
          @dragover="onDragOver"
          @dragleave="onDragLeave"
          @drop="onDrop"
        >
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 class="text-sm font-semibold text-slate-900">HTML content</h2>
              <p class="mt-0.5 text-xs text-slate-500">
                Paste or upload HTML (.html, .htm).{{
                  canUploadTemplateImage
                    ? ' Upload auto-hosts embedded/remote images into Images. Insert/Replace still work for manual picks. Relative paths need Replace.'
                    : ' Saving hosts embedded/remote images so sends stay unbroken.'
                }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <input
                ref="fileInputRef"
                type="file"
                accept=".html,.htm,text/html"
                class="sr-only"
                :disabled="anyImageBusy"
                @change="onFileChange"
              >
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
                :disabled="anyImageBusy"
                @click="onBrowseClick"
              >
                {{ uploadPending ? 'Uploading & hosting images…' : 'Upload file' }}
              </button>
              <button
                v-if="canUploadTemplateImage"
                type="button"
                class="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                :disabled="anyImageBusy"
                @click="openInsertImagePicker"
              >
                Insert image
              </button>
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                :disabled="anyImageBusy"
                @click="validatePasteHtml"
              >
                Validate HTML
              </button>
            </div>
          </div>
          <p v-if="uploadError" class="mt-2 text-sm text-red-600" role="alert">
            {{ uploadError }}
          </p>
          <p v-if="imageUploadError" class="mt-2 text-sm text-red-600" role="alert">
            {{ imageUploadError }}
          </p>

          <div
            v-if="showTemplateImageReplace"
            class="mt-4 rounded-xl border border-slate-200 bg-white px-3 py-3"
            aria-label="Images in this template"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Images in this template
                <span class="ml-1 tabular-nums text-slate-400">({{ templateHtmlImages.length }})</span>
              </p>
              <p class="text-xs text-slate-500">
                Replace updates that image only — no HTML editing needed.
              </p>
            </div>
            <ul class="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              <li
                v-for="img in templateHtmlImages"
                :key="`tpl-img-${img.index}-${img.tagStart}`"
                class="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/80 p-2"
              >
                <div class="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white">
                  <img
                    v-if="img.src"
                    :src="img.src"
                    alt=""
                    class="max-h-full max-w-full object-contain"
                  >
                  <span v-else class="px-1 text-center text-[10px] font-medium text-slate-400">No src</span>
                </div>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-xs font-semibold text-slate-800" :title="emailTemplateHtmlImageLabel(img.src, img.index)">
                    {{ emailTemplateHtmlImageLabel(img.src, img.index) }}
                  </p>
                  <button
                    type="button"
                    class="mt-1.5 inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    :disabled="anyImageBusy"
                    @click="openReplaceImagePicker(img.index)"
                  >
                    Replace
                  </button>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div class="grid min-h-[480px] lg:grid-cols-2">
          <section class="flex min-h-[280px] flex-col border-b border-slate-200 lg:min-h-0 lg:border-b-0 lg:border-r">
            <div class="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
              <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">HTML code</span>
              <button
                type="button"
                class="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-200/60 hover:text-slate-800"
                @click="htmlContent = ''; uploadError = ''"
              >
                Clear
              </button>
            </div>
            <textarea
              ref="htmlTextareaRef"
              v-model="htmlContent"
              class="min-h-[240px] flex-1 resize-none border-0 bg-slate-950 px-4 py-4 font-mono text-[13px] leading-relaxed text-slate-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500/40"
              placeholder="<!DOCTYPE html>&#10;<html>&#10;  …&#10;</html>"
              spellcheck="false"
              :disabled="anyImageBusy"
              @focus="lastFocusedField = 'html'"
            />
          </section>

          <section class="flex min-h-[280px] flex-col lg:min-h-0">
            <div class="flex shrink-0 items-center border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
              <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">Preview</span>
            </div>
            <div class="relative min-h-[240px] flex-1 bg-[#f8f4ef]">
              <iframe
                :srcdoc="previewDoc"
                title="HTML preview"
                class="absolute inset-0 h-full w-full border-0"
                sandbox="allow-same-origin"
              />
            </div>
          </section>
        </div>
      </div>

      <p v-if="formError" class="text-sm text-red-600" role="alert">
        {{ formError }}
      </p>

      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <NuxtLink
          to="/tenant/email-templates"
          class="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Cancel
        </NuxtLink>
        <button
          type="submit"
          class="inline-flex items-center justify-center rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary-600/20 transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="saving || uploadPending || !htmlContent.trim()"
        >
          {{ saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Save template') }}
        </button>
      </div>
      </div>
    </form>

    <TenantUnsubscribeFooterAppendedModal
      :open="unsubscribeFooterModalOpen"
      :title="unsubscribeFooterModalTitle"
      :message="unsubscribeFooterModalMessage"
      :confirm-text="unsubscribeFooterModalConfirm"
      :preview-text="unsubscribeFooterModalPreview"
      @preview="openUnsubscribeFooterPreview"
      @close="closeUnsubscribeFooterModal"
    />
    <TenantEmailTemplatePreviewModal
      :open="unsubscribeFooterPreviewOpen"
      :name="name.trim() || 'Email template'"
      :subject="subject"
      :html="unsubscribeFooterPreviewHtml"
      elevated
      @close="closeUnsubscribeFooterPreview"
    />
    <TenantHostedImagePickerModal
      v-if="canUploadTemplateImage"
      :open="imagePickerOpen"
      :title="imagePickerTitle"
      :confirm-text="imagePickerConfirmText"
      @close="closeImagePicker"
      @select="onHostedImagePicked"
    />
  </div>
</template>
