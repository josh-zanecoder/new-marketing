<script setup lang="ts">
import { emailTemplateStarterHtml } from '~~/shared/utils/emailTemplateBlocks'
import { emailImageBuilderExportHtml } from '~~/shared/utils/emailTemplateHtmlImages'
import { ensureEmailTemplateUnsubscribe } from '~~/shared/utils/ensureEmailTemplateUnsubscribe'
import { normalizeUploadedEmailHtml } from '~~/shared/utils/uploadedEmailHtml'

definePageMeta({ layout: 'default' })

const route = useRoute()
const router = useRouter()
const toast = useAppToast()
const marketingApi = useTenantMarketingApi()
const sidebarCompact = useState('layout-marketing-sidebar-compact', () => false)
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

const isDirty = computed(() =>
  html.value !== savedHtml.value
  || name.value.trim() !== savedMeta.value.name
  || subject.value.trim() !== savedMeta.value.subject
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

function confirmDiscard(): boolean {
  if (!isDirty.value || typeof window === 'undefined') return true
  return window.confirm('You have unsaved changes. Leave without saving?')
}

async function newBlank() {
  if (!confirmDiscard()) return
  templateId.value = ''
  if (queryTemplateId()) await router.replace({ query: {} })
  startBlank()
}

function onLoadedTemplate(template: { id: string; name: string; subject: string }) {
  templateId.value = template.id
  name.value = template.name
  subject.value = template.subject
  savedMeta.value = { name: template.name.trim(), subject: template.subject.trim() }
  savedHtml.value = html.value
  void router.replace({ query: { templateId: template.id } })
}

async function save(mode: 'update' | 'copy') {
  formError.value = ''
  const templateName = mode === 'copy' ? `${name.value.trim() || 'Untitled email'} (copy)` : name.value.trim()
  const templateSubject = subject.value.trim()
  if (!templateName) {
    formError.value = 'Template name is required.'
    return
  }
  if (!templateSubject) {
    formError.value = 'Subject is required.'
    return
  }
  let output = ''
  let footerAppended = false
  try {
    const check = ensureEmailTemplateUnsubscribe(normalizeUploadedEmailHtml(emailImageBuilderExportHtml(html.value)))
    output = check.html
    footerAppended = check.footerAppended
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'This email has no content to save.'
    return
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
      await router.replace({ query: { templateId: created.template.id } })
    }
    html.value = output
    savedHtml.value = output
    savedMeta.value = { name: templateName, subject: templateSubject }
    clearNuxtPayloadCache(TENANT_EMAIL_TEMPLATES_INDEX_CACHE_KEY)
    toast.success(footerAppended ? 'Saved. An unsubscribe link was added at the bottom.' : 'Saved to Email templates')
  } catch {
    formError.value = 'Could not save this template. Please try again.'
  } finally {
    saving.value = false
  }
}

function onBeforeUnload(event: BeforeUnloadEvent) {
  if (!isDirty.value) return
  event.preventDefault()
  event.returnValue = ''
}

onBeforeRouteLeave((to) => {
  if (to.path === route.path) return true
  return confirmDiscard()
})

watch(() => route.query.templateId, () => {
  if (status.value !== 'loading' && queryTemplateId() !== templateId.value) void openFromRoute()
})

onMounted(async () => {
  window.addEventListener('beforeunload', onBeforeUnload)
  if (!tenantFlagsLoaded.value) await loadDefaultCampaignSender()
  if (!allowTenantTemplateBuilder.value) {
    await navigateTo('/tenant/dashboard')
    return
  }
  await openFromRoute()
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
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
      <p v-if="formError" class="w-full text-sm text-rose-600">{{ formError }}</p>
    </header>

    <div class="relative flex min-h-0 flex-1">
      <TenantEmailTemplateImageBuilder
        v-if="status === 'ready'"
        :key="builderKey"
        v-model="html"
        class="min-h-0 flex-1"
        :source-html="sourceHtml"
        :can-upload-image="true"
        :can-edit-text="allowTenantEditText"
        :can-resize-image="allowTenantResizeImage"
        :can-replace-image="allowTenantReplaceImage"
        @loaded-template="onLoadedTemplate"
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
  </div>
</template>
