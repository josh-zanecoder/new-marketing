<script setup lang="ts">
import { emailTemplateStarterHtml } from '~~/shared/utils/emailTemplateBlocks'
import { emailImageBuilderExportHtml } from '~~/shared/utils/emailTemplateHtmlImages'
import { ensureEmailTemplateUnsubscribe } from '~~/shared/utils/ensureEmailTemplateUnsubscribe'
import { normalizeUploadedEmailHtml } from '~~/shared/utils/uploadedEmailHtml'
import { isEmailTemplateDirty } from '~~/shared/utils/isEmailTemplateDirty'
import {
  TEMPLATE_SAVE_ERROR_EMPTY_CONTENT,
  TEMPLATE_SAVE_ERROR_GENERIC,
  TEMPLATE_SAVE_ERROR_NAME_REQUIRED,
  TEMPLATE_SAVE_ERROR_SUBJECT_REQUIRED
} from '~~/shared/constants/templateSaveError'

definePageMeta({ layout: 'default' })

const route = useRoute()
const router = useRouter()
const toast = useAppToast()
const marketingApi = useTenantMarketingApi()
const sidebarCompact = useState('layout-marketing-sidebar-compact', () => false)
const unsavedGuard = useUnsavedTemplateGuard()
const unsavedOpen = unsavedGuard.open
const unsavedBusy = unsavedGuard.busy
const {
  allowTenantTemplateBuilder,
  allowTenantEditText,
  allowTenantResizeImage,
  allowTenantReplaceImage,
  loadDefaultCampaignSender,
  loaded: tenantFlagsLoaded
} = useDefaultCampaignSender()

const html = ref('')
const sourceHtml = ref('')
const savedHtml = ref('')
const templateId = ref('')
const name = ref('')
const subject = ref('')
const savedMeta = ref({ name: '', subject: '' })
const builderKey = ref(0)
const status = ref<'loading' | 'ready' | 'error'>('loading')
const loadError = ref('')
const saving = ref(false)
const formError = ref('')
const saveErrorOpen = ref(false)
const builderRef = ref<{ applyLoadTemplate: (id: string) => Promise<void> } | null>(null)
/** Skip one route-query open after we intentionally change templateId ourselves. */
const skipNextQueryOpen = ref(false)

const {
  canUndo,
  canRedo,
  undo,
  redo,
  resetFromCurrent: resetEditHistory
} = useTemplateBuilderHistory({ html, name, subject })

const isDirty = computed(() =>
  isEmailTemplateDirty(
    { html: html.value, name: name.value, subject: subject.value },
    { html: savedHtml.value, name: savedMeta.value.name, subject: savedMeta.value.subject }
  )
)

function queryTemplateId(): string {
  const raw = Array.isArray(route.query.templateId) ? route.query.templateId[0] : route.query.templateId
  const id = typeof raw === 'string' ? raw.trim() : ''
  return /^[a-f0-9]{24}$/i.test(id) ? id : ''
}

function openDocument(next: { id: string; name: string; subject: string; html: string }) {
  templateId.value = next.id
  name.value = next.name
  subject.value = next.subject
  savedMeta.value = { name: next.name.trim(), subject: next.subject.trim() }
  html.value = next.html
  sourceHtml.value = next.html
  savedHtml.value = next.html
  formError.value = ''
  builderKey.value += 1
  void nextTick(() => resetEditHistory())
}

function startBlank() {
  openDocument({ id: '', name: '', subject: '', html: emailTemplateStarterHtml() })
  status.value = 'ready'
}

async function openFromRoute() {
  const id = queryTemplateId()
  if (id && id === templateId.value) return
  status.value = 'loading'
  loadError.value = ''
  if (!id) {
    startBlank()
    return
  }
  try {
    const res = await marketingApi.fetchEmailTemplateById(id)
    openDocument({
      id,
      name: res.template.name?.trim() ?? '',
      subject: res.template.subject?.trim() ?? '',
      html: res.template.htmlTemplate ?? ''
    })
    status.value = 'ready'
  } catch {
    status.value = 'error'
    loadError.value = 'Could not open this template.'
  }
}

/** Stay / discard / save before replacing the editor or leaving the page. */
async function allowLeaveOrReplace(): Promise<boolean> {
  formError.value = ''
  return unsavedGuard.confirmIfDirty(isDirty.value, {
    onSave: () => save('update')
  })
}

async function newBlank() {
  if (!(await allowLeaveOrReplace())) return
  templateId.value = ''
  if (queryTemplateId()) {
    skipNextQueryOpen.value = true
    await router.replace({ query: {} })
  }
  startBlank()
}

function onLoadedTemplate(template: { id: string; name: string; subject: string }) {
  templateId.value = template.id
  name.value = template.name
  subject.value = template.subject
  savedMeta.value = { name: template.name.trim(), subject: template.subject.trim() }
  savedHtml.value = html.value
  skipNextQueryOpen.value = true
  void router.replace({ query: { templateId: template.id } })
  void nextTick(() => resetEditHistory())
}

function onHistoryKeydown(event: KeyboardEvent) {
  if (status.value !== 'ready' || saving.value) return
  const target = event.target
  if (target instanceof HTMLElement) {
    const tag = target.tagName
    // Allow undo/redo even in name/subject inputs; skip when typing in other fields if needed.
    if (tag === 'TEXTAREA') return
  }
  const key = event.key.toLowerCase()
  const mod = event.metaKey || event.ctrlKey
  if (!mod) return
  if (key === 'z' && !event.shiftKey) {
    event.preventDefault()
    undo()
    return
  }
  if ((key === 'z' && event.shiftKey) || key === 'y') {
    event.preventDefault()
    redo()
  }
}

async function onRequestLoadTemplate(id: string) {
  if (!(await allowLeaveOrReplace())) return
  await builderRef.value?.applyLoadTemplate(id)
}

function reportSaveError(message: string) {
  formError.value = message
  // Unsaved-changes dialog already shows `formError`; otherwise open the save-error modal.
  if (!unsavedOpen.value) saveErrorOpen.value = true
}

function closeSaveError() {
  saveErrorOpen.value = false
}

async function save(mode: 'update' | 'copy'): Promise<boolean> {
  formError.value = ''
  saveErrorOpen.value = false
  const templateName = mode === 'copy' ? `${name.value.trim() || 'Untitled email'} (copy)` : name.value.trim()
  const templateSubject = subject.value.trim()
  if (!templateName) {
    reportSaveError(TEMPLATE_SAVE_ERROR_NAME_REQUIRED)
    return false
  }
  if (!templateSubject) {
    reportSaveError(TEMPLATE_SAVE_ERROR_SUBJECT_REQUIRED)
    return false
  }
  let output = ''
  let footerAppended = false
  try {
    const check = ensureEmailTemplateUnsubscribe(normalizeUploadedEmailHtml(emailImageBuilderExportHtml(html.value)))
    output = check.html
    footerAppended = check.footerAppended
  } catch (e) {
    reportSaveError(e instanceof Error ? e.message : TEMPLATE_SAVE_ERROR_EMPTY_CONTENT)
    return false
  }
  saving.value = true
  try {
    const body = {
      name: templateName,
      subject: templateSubject,
      htmlTemplate: output,
      htmlSource: 'upload' as const,
      saveToLibrary: true
    }
    if (mode === 'update' && templateId.value) {
      await marketingApi.updateEmailTemplate(templateId.value, body)
    } else {
      const created = await marketingApi.createEmailTemplate(body)
      templateId.value = created.template.id
      name.value = templateName
      skipNextQueryOpen.value = true
      await router.replace({ query: { templateId: created.template.id } })
    }
    html.value = output
    savedHtml.value = output
    savedMeta.value = { name: templateName, subject: templateSubject }
    clearNuxtPayloadCache(TENANT_EMAIL_TEMPLATES_INDEX_CACHE_KEY)
    toast.success(footerAppended ? 'Saved. An unsubscribe link was added at the bottom.' : 'Saved to Email templates')
    return true
  } catch {
    reportSaveError(TEMPLATE_SAVE_ERROR_GENERIC)
    return false
  } finally {
    saving.value = false
  }
}

function onBeforeUnload(event: BeforeUnloadEvent) {
  if (!isDirty.value) return
  event.preventDefault()
  event.returnValue = ''
}

onBeforeRouteLeave(async (to) => {
  if (to.path === route.path) return true
  return allowLeaveOrReplace()
})

watch(() => route.query.templateId, async () => {
  if (skipNextQueryOpen.value) {
    skipNextQueryOpen.value = false
    return
  }
  if (status.value === 'loading') return
  const nextId = queryTemplateId()
  if (nextId === templateId.value) return
  if (!(await allowLeaveOrReplace())) {
    skipNextQueryOpen.value = true
    await router.replace({
      query: templateId.value ? { templateId: templateId.value } : {}
    })
    return
  }
  await openFromRoute()
})

onMounted(async () => {
  window.addEventListener('beforeunload', onBeforeUnload)
  window.addEventListener('keydown', onHistoryKeydown)
  if (!tenantFlagsLoaded.value) await loadDefaultCampaignSender()
  if (!allowTenantTemplateBuilder.value) {
    await navigateTo('/tenant/dashboard')
    return
  }
  await openFromRoute()
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
  window.removeEventListener('keydown', onHistoryKeydown)
})
</script>

<template>
  <div
    class="fixed inset-y-0 right-0 z-30 flex min-h-0 flex-col overflow-hidden bg-slate-100"
    :class="sidebarCompact ? 'left-16' : 'left-0 lg:left-72'"
  >
    <header class="flex shrink-0 flex-wrap items-end gap-3 border-b border-slate-200 bg-white px-4 py-3">
      <div class="min-w-0 shrink-0">
        <h1 class="text-sm font-semibold text-slate-900">Template builder</h1>
        <p class="text-xs text-slate-500">
          {{ templateId ? 'Editing a saved template' : 'New email' }}
          <span v-if="isDirty" class="ml-1 font-medium text-amber-600">· Unsaved changes</span>
        </p>
      </div>
      <label class="min-w-[12rem] flex-1">
        <span class="text-[11px] font-medium text-slate-500">Template name</span>
        <input
          v-model="name"
          type="text"
          class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          placeholder="e.g. November newsletter"
          autocomplete="off"
        >
      </label>
      <label class="min-w-[12rem] flex-1">
        <span class="text-[11px] font-medium text-slate-500">Subject</span>
        <input
          v-model="subject"
          type="text"
          class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          placeholder="What readers see in their inbox"
          autocomplete="off"
        >
      </label>
      <div class="flex shrink-0 items-center gap-2">
        <div class="flex items-center rounded-lg border border-slate-300 bg-white p-0.5">
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="saving || status !== 'ready' || !canUndo"
            title="Undo (Ctrl/⌘ Z)"
            aria-label="Undo"
            @click="undo"
          >
            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fill-rule="evenodd"
                d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                clip-rule="evenodd"
              />
            </svg>
            Undo
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="saving || status !== 'ready' || !canRedo"
            title="Redo (Ctrl/⌘ Shift Z)"
            aria-label="Redo"
            @click="redo"
          >
            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fill-rule="evenodd"
                d="M12.293 3.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 7H9a5 5 0 00-5 5v2a1 1 0 11-2 0v-2a7 7 0 017-7h5.586l-2.293-2.293a1 1 0 010-1.414z"
                clip-rule="evenodd"
              />
            </svg>
            Redo
          </button>
        </div>
        <button
          type="button"
          class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          :disabled="saving"
          @click="newBlank"
        >
          New blank
        </button>
        <button
          v-if="templateId"
          type="button"
          class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          :disabled="saving || status !== 'ready'"
          @click="save('copy')"
        >
          Save as copy
        </button>
        <button
          type="button"
          class="rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          :disabled="saving || status !== 'ready' || (Boolean(templateId) && !isDirty)"
          @click="save('update')"
        >
          {{ saving ? 'Saving…' : templateId ? 'Save' : 'Save template' }}
        </button>
      </div>
    </header>

    <div class="relative flex min-h-0 flex-1">
      <TenantEmailTemplateImageBuilder
        v-if="status === 'ready'"
        ref="builderRef"
        :key="builderKey"
        v-model="html"
        class="min-h-0 flex-1"
        :source-html="sourceHtml"
        :has-unsaved-changes="isDirty"
        :can-upload-image="true"
        :can-edit-text="allowTenantEditText"
        :can-resize-image="allowTenantResizeImage"
        :can-replace-image="allowTenantReplaceImage"
        @loaded-template="onLoadedTemplate"
        @request-load-template="onRequestLoadTemplate"
      />
      <div v-else-if="status === 'loading'" class="flex flex-1 flex-col items-center justify-center gap-3">
        <div class="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-primary-600" />
        <p class="text-sm text-slate-500">Opening the template builder…</p>
      </div>
      <div v-else class="flex flex-1 items-center justify-center p-6">
        <div class="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p class="text-sm text-slate-700">{{ loadError }}</p>
          <div class="mt-4 flex justify-center gap-2">
            <button
              type="button"
              class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              @click="newBlank"
            >
              Start blank
            </button>
            <button
              type="button"
              class="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
              @click="openFromRoute"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    </div>

    <TenantUnsavedTemplateChangesModal
      :open="unsavedOpen"
      :title="unsavedGuard.title"
      :message="unsavedGuard.message"
      :stay-text="unsavedGuard.stayText"
      :discard-text="unsavedGuard.discardText"
      :save-text="unsavedGuard.saveText"
      :busy="unsavedBusy || saving"
      :error="formError"
      @stay="unsavedGuard.stay"
      @discard="unsavedGuard.discard"
      @save="unsavedGuard.saveAndContinue"
    />

    <TenantTemplateSaveErrorModal
      :open="saveErrorOpen"
      :message="formError"
      @close="closeSaveError"
    />
  </div>
</template>
