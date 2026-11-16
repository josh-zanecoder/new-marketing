<script setup lang="ts">
/**
 * Host shell for the in-Marketing Grapes builder.
 * Grapes runs in an iframe (same-origin `/grapes-builder/` by default) so a crash
 * there cannot take down Nuxt — same isolation idea as in-repo workers.
 */
import { normalizeEmailTemplateForStorage } from '~~/shared/utils/emailEditorHtml'

definePageMeta({ layout: 'default' })

const CHANNEL = 'email-grapes-builder'

type BuilderToHost =
  | { channel: string; type: 'ready' }
  | { channel: string; type: 'save'; html: string; name?: string; subject?: string; templateId?: string | null }
  | { channel: string; type: 'upload-request'; requestId: string; dataUrl: string; fileName: string }
  | { channel: string; type: 'pick-image-request'; requestId: string }
  | { channel: string; type: 'crash'; message: string }

type PendingLoad = {
  html: string
  name: string
  subject: string
  templateId: string | null
}

const config = useRuntimeConfig()
const toast = useAppToast()
const marketingApi = useTenantMarketingApi()
const route = useRoute()
const sidebarCompact = useState('layout-marketing-sidebar-compact', () => false)
const {
  grapesBuilderUrl: tenantGrapesBuilderUrl,
  loadDefaultCampaignSender,
  loaded: tenantFlagsLoaded
} = useDefaultCampaignSender()

const iframeRef = ref<HTMLIFrameElement | null>(null)
const builderReady = ref(false)
const status = ref('')
const saveOpen = ref(false)
const saveName = ref('')
const saveSubject = ref('')
const saveError = ref('')
const savePending = ref(false)
const loadOpen = ref(false)
const templatesPending = ref(false)
const templatesError = ref('')
const templateQuery = ref('')
const templates = ref<Array<{ id: string; name: string; subject: string }>>([])
const loadPending = ref(false)
const activeTemplateLabel = ref('')
const imagePickerOpen = ref(false)
const imagePickRequestId = ref<string | null>(null)

let pendingHtml = ''
let savedTemplateId: string | null = null
let builderOrigin = ''
let bootstrapped = false
let pendingLoad: PendingLoad | null = null

const SAME_ORIGIN_BUILDER_PATH = '/grapes-builder'

const builderSrc = computed(() => {
  const fromTenant = String(tenantGrapesBuilderUrl.value || '').trim().replace(/\/+$/, '')
  const fromEnv = String(config.public.grapesBuilderUrl || '').trim().replace(/\/+$/, '')
  const override = fromTenant || fromEnv

  if (override) {
    try {
      builderOrigin = new URL(override).origin
    } catch {
      builderOrigin = ''
    }
    return `${override}/?embed=1`
  }

  // Default: serve from Marketing public/ (same origin as this page).
  if (import.meta.client) {
    builderOrigin = window.location.origin
  } else {
    builderOrigin = ''
  }
  return `${SAME_ORIGIN_BUILDER_PATH}/?embed=1`
})

const filteredTemplates = computed(() => {
  const q = templateQuery.value.trim().toLowerCase()
  if (!q) return templates.value
  return templates.value.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.subject.toLowerCase().includes(q)
  )
})

function queryParamString(q: unknown): string {
  if (q == null) return ''
  if (Array.isArray(q)) return typeof q[0] === 'string' ? q[0] : ''
  return typeof q === 'string' ? q : String(q)
}

function readFetchMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const data = (error as { data?: { message?: string; statusMessage?: string } }).data
    const msg = typeof data?.message === 'string' ? data.message.trim() : ''
    if (msg) return msg
    const message = (error as { message?: string }).message
    if (typeof message === 'string' && message.trim()) return message.trim()
  }
  return fallback
}

function postToBuilder(message: Record<string, unknown>) {
  const win = iframeRef.value?.contentWindow
  if (!win) return
  win.postMessage({ channel: CHANNEL, ...message }, builderOrigin || '*')
}

function applyLoad(load: PendingLoad) {
  savedTemplateId = load.templateId
  saveName.value = load.name
  saveSubject.value = load.subject
  activeTemplateLabel.value = load.name || (load.templateId ? 'Loaded template' : '')
  postToBuilder({
    type: 'load',
    html: load.html,
    name: load.name,
    subject: load.subject,
    templateId: load.templateId
  })
}

function queueOrApplyLoad(load: PendingLoad) {
  if (builderReady.value) {
    applyLoad(load)
    return
  }
  pendingLoad = load
  status.value = 'Template selected — waiting for editor…'
}

async function openLoadDialog() {
  loadOpen.value = true
  templatesError.value = ''
  templateQuery.value = ''
  templatesPending.value = true
  try {
    const res = await marketingApi.fetchEmailTemplates()
    templates.value = (res.templates || []).map((t) => ({
      id: t.id,
      name: t.name || 'Untitled',
      subject: t.subject || ''
    }))
  } catch (error) {
    templatesError.value = readFetchMessage(error, 'Could not load templates')
  } finally {
    templatesPending.value = false
  }
}

async function loadTemplate(id: string) {
  loadPending.value = true
  templatesError.value = ''
  try {
    const res = await marketingApi.fetchEmailTemplateById(id)
    const load: PendingLoad = {
      html: res.template.htmlTemplate || '',
      name: res.template.name || '',
      subject: res.template.subject || '',
      templateId: res.template.id
    }
    loadOpen.value = false
    queueOrApplyLoad(load)
    toast.success(builderReady.value ? 'Template loaded' : 'Template queued')
  } catch (error) {
    templatesError.value = readFetchMessage(error, 'Could not open that template')
  } finally {
    loadPending.value = false
  }
}

function newBlank() {
  savedTemplateId = null
  saveName.value = ''
  saveSubject.value = ''
  activeTemplateLabel.value = ''
  pendingLoad = null
  if (builderReady.value) {
    postToBuilder({ type: 'new' })
  } else {
    queueOrApplyLoad({ html: '', name: '', subject: '', templateId: null })
  }
}

function requestSave() {
  if (!builderReady.value) {
    toast.error('Editor is still starting')
    return
  }
  postToBuilder({ type: 'request-save' })
}

function openSaveDialog(html: string, meta?: { name?: string; subject?: string; templateId?: string | null }) {
  // Safety net: always persist a full HTML document like the in-app Grapes editor.
  pendingHtml = normalizeEmailTemplateForStorage(html || '')
  if (meta?.name) saveName.value = meta.name
  if (meta?.subject) saveSubject.value = meta.subject
  if (meta?.templateId) savedTemplateId = meta.templateId
  if (!saveName.value.trim()) saveName.value = 'Untitled email'
  saveError.value = ''
  saveOpen.value = true
}

async function confirmSave() {
  const name = saveName.value.trim()
  const subject = saveSubject.value.trim()
  if (!name) {
    saveError.value = 'Template name is required'
    return
  }
  if (!subject) {
    saveError.value = 'Default subject is required'
    return
  }
  if (!pendingHtml.trim()) {
    saveError.value = 'This design has no HTML to save'
    return
  }

  savePending.value = true
  saveError.value = ''
  try {
    if (savedTemplateId) {
      await marketingApi.updateEmailTemplate(savedTemplateId, {
        name,
        subject,
        htmlTemplate: pendingHtml,
        htmlSource: 'editor'
      })
      toast.success('Template updated')
    } else {
      const created = await marketingApi.createEmailTemplate({
        name,
        subject,
        htmlTemplate: pendingHtml,
        htmlSource: 'editor',
        saveToLibrary: true
      })
      savedTemplateId = created.template.id
      toast.success('Template saved')
    }
    activeTemplateLabel.value = name
    saveOpen.value = false
  } catch (error) {
    saveError.value = readFetchMessage(error, 'Could not save template')
  } finally {
    savePending.value = false
  }
}

async function handleUploadRequest(msg: Extract<BuilderToHost, { type: 'upload-request' }>) {
  try {
    // Prefer tenant Images library so uploads show under Images.
    const uploaded = await marketingApi.uploadTenantHostedImage({ dataUrl: msg.dataUrl })
    if (!uploaded.url) throw new Error('Upload did not return a URL')
    postToBuilder({
      type: 'upload-result',
      requestId: msg.requestId,
      url: uploaded.url
    })
  } catch (error) {
    postToBuilder({
      type: 'upload-result',
      requestId: msg.requestId,
      error: readFetchMessage(error, 'Upload failed')
    })
  }
}

function handlePickImageRequest(msg: Extract<BuilderToHost, { type: 'pick-image-request' }>) {
  imagePickRequestId.value = msg.requestId
  imagePickerOpen.value = true
}

function closeImagePicker() {
  const requestId = imagePickRequestId.value
  imagePickerOpen.value = false
  imagePickRequestId.value = null
  if (requestId) {
    postToBuilder({
      type: 'pick-image-result',
      requestId,
      cancelled: true
    })
  }
}

function onHostedImagePicked(item: { url: string; fileName?: string }) {
  const requestId = imagePickRequestId.value
  imagePickerOpen.value = false
  imagePickRequestId.value = null
  if (!requestId) return
  const url = typeof item.url === 'string' ? item.url.trim() : ''
  if (!url) {
    postToBuilder({
      type: 'pick-image-result',
      requestId,
      error: 'Selected image has no URL'
    })
    return
  }
  postToBuilder({
    type: 'pick-image-result',
    requestId,
    url,
    fileName: item.fileName || 'Image'
  })
}

function onMessage(event: MessageEvent) {
  // Accept messages from the builder origin; also allow empty origin during first paint.
  if (builderOrigin && event.origin !== builderOrigin && event.origin !== 'null') return
  const data = event.data as BuilderToHost | null
  if (!data || data.channel !== CHANNEL) return

  if (data.type === 'ready') {
    builderReady.value = true
    status.value = ''
    if (pendingLoad) {
      const load = pendingLoad
      pendingLoad = null
      applyLoad(load)
      bootstrapped = true
      return
    }
    if (!bootstrapped) {
      bootstrapped = true
      const tid = queryParamString(route.query.templateId)
      if (tid) void loadTemplate(tid)
      else applyLoad({ html: '', name: '', subject: '', templateId: null })
    }
    return
  }
  if (data.type === 'save') {
    openSaveDialog(data.html, data)
    return
  }
  if (data.type === 'upload-request') {
    void handleUploadRequest(data)
    return
  }
  if (data.type === 'pick-image-request') {
    handlePickImageRequest(data)
    return
  }
  if (data.type === 'crash') {
    builderReady.value = false
    status.value = 'Editor stopped responding. Reload to continue.'
    toast.error('Editor crashed — Marketing is still running')
  }
}

function reloadBuilder() {
  builderReady.value = false
  bootstrapped = false
  status.value = ''
  const el = iframeRef.value
  if (el) el.src = builderSrc.value
}

function onIframeLoad() {
  if (!builderReady.value) postToBuilder({ type: 'ping' })
}

watch(builderSrc, (next, prev) => {
  if (!prev || next === prev) return
  builderReady.value = false
  bootstrapped = false
})

onMounted(async () => {
  window.addEventListener('message', onMessage)
  if (!tenantFlagsLoaded.value) await loadDefaultCampaignSender()
  window.setTimeout(() => {
    if (!builderReady.value) postToBuilder({ type: 'ping' })
  }, 100)
  window.setTimeout(() => {
    if (!builderReady.value) postToBuilder({ type: 'ping' })
  }, 800)
})

onBeforeUnmount(() => {
  window.removeEventListener('message', onMessage)
})
</script>

<template>
  <div
    class="fixed inset-y-0 right-0 z-30 flex min-h-0 flex-col overflow-hidden bg-slate-950"
    :class="sidebarCompact ? 'left-16' : 'left-0 lg:left-72'"
  >
    <header class="flex h-12 flex-shrink-0 items-center gap-2 border-b border-slate-800 bg-slate-900 px-3">
      <div class="mr-auto min-w-0">
        <h1 class="truncate text-sm font-semibold text-white">Email builder</h1>
        <p v-if="activeTemplateLabel" class="truncate text-[11px] text-slate-400">
          {{ activeTemplateLabel }}
        </p>
      </div>

      <button
        type="button"
        class="rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
        @click="newBlank"
      >
        New
      </button>
      <button
        type="button"
        class="rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
        @click="openLoadDialog"
      >
        Load template
      </button>
      <button
        type="button"
        class="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40"
        :disabled="!builderReady"
        @click="requestSave"
      >
        Save
      </button>
      <button
        type="button"
        class="rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white"
        title="Reload editor"
        @click="reloadBuilder"
      >
        Reload
      </button>
    </header>

    <p
      v-if="status"
      class="flex flex-shrink-0 items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
    >
      <span>{{ status }}</span>
      <button type="button" class="font-medium underline" @click="reloadBuilder">Reload</button>
    </p>

    <iframe
      ref="iframeRef"
      class="min-h-0 w-full flex-1 border-0 bg-slate-950"
      title="Email builder"
      :src="builderSrc"
      referrerpolicy="no-referrer-when-downgrade"
      @load="onIframeLoad"
    />

    <TenantHostedImagePickerModal
      :open="imagePickerOpen"
      title="Choose a saved image"
      confirm-text="Use image"
      @close="closeImagePicker"
      @select="onHostedImagePicked"
    />

    <!-- Save dialog -->
    <div
      v-if="saveOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      @click.self="saveOpen = false"
    >
      <div class="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" role="dialog" aria-modal="true">
        <h2 class="text-lg font-semibold text-slate-900">Save template</h2>
        <label class="mt-4 block text-sm font-medium text-slate-700" for="grapes-iso-name">Name</label>
        <input
          id="grapes-iso-name"
          v-model="saveName"
          type="text"
          class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
        <label class="mt-4 block text-sm font-medium text-slate-700" for="grapes-iso-subject">Subject</label>
        <input
          id="grapes-iso-subject"
          v-model="saveSubject"
          type="text"
          class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
        <p v-if="saveError" class="mt-3 text-sm text-red-600">{{ saveError }}</p>
        <div class="mt-5 flex justify-end gap-2">
          <button
            type="button"
            class="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            :disabled="savePending"
            @click="saveOpen = false"
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
            :disabled="savePending"
            @click="confirmSave"
          >
            {{ savePending ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Load template dialog -->
    <div
      v-if="loadOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      @click.self="loadOpen = false"
    >
      <div
        class="flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="grapes-load-title"
      >
        <div class="border-b border-slate-100 px-5 py-4">
          <div class="flex items-center justify-between gap-3">
            <h2 id="grapes-load-title" class="text-sm font-semibold text-slate-900">
              Load email template
            </h2>
            <button
              type="button"
              class="text-sm text-slate-500 hover:text-slate-800"
              @click="loadOpen = false"
            >
              Close
            </button>
          </div>
          <input
            v-model="templateQuery"
            type="search"
            placeholder="Search by name or subject…"
            class="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            autofocus
          >
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto p-2">
          <p v-if="templatesPending" class="px-3 py-8 text-center text-sm text-slate-500">
            Loading templates…
          </p>
          <p v-else-if="templatesError" class="px-3 py-4 text-sm text-red-600">
            {{ templatesError }}
          </p>
          <p
            v-else-if="filteredTemplates.length === 0"
            class="px-3 py-8 text-center text-sm text-slate-500"
          >
            No templates match.
          </p>
          <ul v-else class="space-y-0.5">
            <li v-for="t in filteredTemplates" :key="t.id">
              <button
                type="button"
                class="flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-slate-50 disabled:opacity-50"
                :disabled="loadPending"
                @click="loadTemplate(t.id)"
              >
                <span class="min-w-0">
                  <span class="block truncate text-sm font-medium text-slate-900">{{ t.name }}</span>
                  <span class="block truncate text-xs text-slate-500">
                    {{ t.subject || 'No subject' }}
                  </span>
                </span>
                <span class="mt-0.5 flex-shrink-0 text-xs font-medium text-blue-600">Load</span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>
