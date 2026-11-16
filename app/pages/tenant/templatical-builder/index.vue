<script setup lang="ts">
import { compressCustomMarketingImageFile } from '~/utils/compressCustomMarketingImage'
import { ensureEmailTemplateUnsubscribe } from '~~/shared/utils/ensureEmailTemplateUnsubscribe'
import {
  extractTemplaticalContent,
  packTemplaticalHtml,
  stripTemplaticalPayload,
  type TemplaticalTemplateContent
} from '~~/shared/utils/templaticalEmailTemplate'

definePageMeta({ layout: 'default' })

type TemplaticalEditor = {
  unmount: () => void
  getContent: () => TemplaticalTemplateContent
  setContent: (content: TemplaticalTemplateContent) => void
  toHtml: () => Promise<string>
}

type MergeTag = { label: string; value: string; group?: string }
type DynamicVariableItem = {
  id: string
  key: string
  label: string
  sourceType?: 'recipient' | 'user'
  scopes?: Array<'subject' | 'body'>
  enabled?: boolean
}

const sidebarCompact = useState('layout-marketing-sidebar-compact', () => false)
const marketingApi = useTenantMarketingApi()
const toast = useAppToast()
const route = useRoute()

const hostRef = ref<HTMLElement | null>(null)
const status = ref<'loading' | 'ready' | 'error'>('loading')
const loadError = ref('')
const busy = ref(false)

const saveOpen = ref(false)
const saveName = ref('')
const saveSubject = ref('')
const saveError = ref('')
const savePending = ref(false)
const savedTemplateId = ref<string | null>(null)

const openOpen = ref(false)
const templatesPending = ref(false)
const templatesError = ref('')
const templates = ref<Array<{ id: string; name: string; subject: string }>>([])

const dynamicVariables = ref<DynamicVariableItem[]>([])

let editor: TemplaticalEditor | null = null
let startToken = 0

const FALLBACK_VARS: DynamicVariableItem[] = [
  { id: '1', key: 'user.firstName', label: 'First Name', sourceType: 'user', scopes: ['body', 'subject'], enabled: true },
  { id: '2', key: 'user.lastName', label: 'Last Name', sourceType: 'user', scopes: ['body', 'subject'], enabled: true },
  { id: '3', key: 'user.email', label: 'Email', sourceType: 'user', scopes: ['body'], enabled: true },
  { id: '4', key: 'unsubscribe', label: 'Unsubscribe link', sourceType: 'recipient', scopes: ['body'], enabled: true }
]

function readFetchMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const data = (error as { data?: { message?: string; statusMessage?: string } }).data
    if (typeof data?.statusMessage === 'string' && data.statusMessage.trim()) return data.statusMessage.trim()
    if (typeof data?.message === 'string' && data.message.trim()) return data.message.trim()
    const message = (error as { message?: string }).message
    if (typeof message === 'string' && message.trim()) return message.trim()
  }
  return fallback
}

function queryParamString(q: unknown): string {
  if (q == null) return ''
  if (Array.isArray(q)) return typeof q[0] === 'string' ? q[0] : ''
  return typeof q === 'string' ? q : String(q)
}

function mergeTagsFromVariables(list: DynamicVariableItem[]): MergeTag[] {
  const tags: MergeTag[] = []
  for (const v of list) {
    if (v.enabled === false) continue
    if (v.scopes?.length && !v.scopes.includes('body')) continue
    if (!v.key?.trim()) continue
    tags.push({
      label: v.label || v.key,
      value: `{{${v.key}}}`,
      group: v.sourceType === 'user' ? 'User' : 'Recipient'
    })
  }
  return tags
}

async function loadDynamicVariables() {
  try {
    const res = await marketingApi.fetchDynamicVariables()
    const mapped = (res.variables || []).map((v) => ({
      id: String(v.id || v.key),
      key: v.key,
      label: v.label || v.key,
      sourceType: v.sourceType,
      scopes: v.scopes,
      enabled: v.enabled
    }))
    dynamicVariables.value = mapped.length ? mapped : FALLBACK_VARS
  } catch {
    dynamicVariables.value = FALLBACK_VARS
  }
}

function buildMediaProvider() {
  return {
    list: async () => {
      try {
        const res = await marketingApi.fetchEmailTemplateImages()
        return {
          items: (res.items || []).map((item) => ({
            id: item.id || item.objectPath || item.url,
            url: item.url,
            filename: item.fileName,
            mimeType: item.contentType,
            size: item.size,
            createdAt: item.createdAt
          })),
          nextCursor: null
        }
      } catch {
        return { items: [], nextCursor: null }
      }
    },
    create: async ({ file }: { file: File }) => {
      const dataUrl = await compressCustomMarketingImageFile(file, {
        maxSourceBytes: 8 * 1024 * 1024
      })
      const uploaded = await marketingApi.uploadEmailTemplateImage({ dataUrl })
      const url = typeof uploaded?.url === 'string' ? uploaded.url.trim() : ''
      if (!url) throw new Error('Upload succeeded but no image link was returned.')
      return {
        id: uploaded.objectPath || url,
        url,
        filename: file.name,
        mimeType: file.type,
        size: file.size
      }
    },
    update: false as const,
    delete: false as const,
    folders: false as const,
    replace: false as const,
    importFromUrl: false as const,
    checkUsage: false as const,
    frequentlyUsed: false as const,
    storage: false as const
  }
}

async function compileMjml(mjml: string): Promise<string> {
  const mod = await import('mjml-browser')
  const mjml2html = (mod as { default?: (input: string) => { html: string } }).default || (mod as unknown as (input: string) => { html: string })
  const result = mjml2html(mjml)
  return result.html
}

async function contentFromHtml(html: string): Promise<TemplaticalTemplateContent | undefined> {
  const existing = extractTemplaticalContent(html)
  if (existing?.blocks) return existing
  const clean = stripTemplaticalPayload(html).trim()
  if (!clean) return undefined
  const { convertHtmlTemplate } = await import('@templatical/import-html')
  const { content } = convertHtmlTemplate(clean)
  return content as TemplaticalTemplateContent
}

async function startEditor(initial?: TemplaticalTemplateContent) {
  const token = ++startToken
  status.value = 'loading'
  loadError.value = ''
  editor?.unmount()
  editor = null
  await nextTick()
  if (!hostRef.value) {
    status.value = 'error'
    loadError.value = 'Editor container missing'
    return
  }
  try {
    if (!document.getElementById('templatical-editor-css')) {
      const link = document.createElement('link')
      link.id = 'templatical-editor-css'
      link.rel = 'stylesheet'
      link.href = '/vendor/templatical-editor.css'
      document.head.appendChild(link)
    }
    await loadDynamicVariables()
    if (token !== startToken) return

    const { init } = await import('@templatical/editor')
    if (token !== startToken) return

    editor = (await init({
      container: hostRef.value,
      branding: false,
      smallScreenNotice: false,
      templateSettings: { fields: ['width', 'backgroundColor', 'fontFamily', 'textColor'] },
      templateDefaults: {
        width: 600,
        backgroundColor: '#f4f4f5'
      },
      mergeTags: {
        syntax: 'handlebars',
        tags: mergeTagsFromVariables(dynamicVariables.value),
        autocomplete: true,
        showRawValue: true
      },
      media: buildMediaProvider(),
      render: {
        compileMjml
      },
      ...(initial ? { content: initial as never } : {}),
      onError() {
        toast.error('The email builder hit an error')
      }
    })) as unknown as TemplaticalEditor

    if (token !== startToken) {
      editor.unmount()
      editor = null
      return
    }
    status.value = 'ready'
  } catch (error) {
    if (token !== startToken) return
    status.value = 'error'
    loadError.value = readFetchMessage(error, 'Could not open the Templatical builder')
  }
}

async function exportPackedHtml(): Promise<string> {
  if (!editor) throw new Error('Editor is not ready')
  const content = editor.getContent()
  const html = await editor.toHtml()
  const withUnsub = ensureEmailTemplateUnsubscribe(html).html
  return packTemplaticalHtml(withUnsub, content)
}

function openSaveDialog() {
  saveError.value = ''
  if (!saveName.value.trim()) saveName.value = 'Untitled email'
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
  savePending.value = true
  saveError.value = ''
  try {
    const htmlTemplate = await exportPackedHtml()
    const body = {
      name,
      subject,
      htmlTemplate,
      htmlSource: 'editor' as const
    }
    if (savedTemplateId.value) {
      await marketingApi.updateEmailTemplate(savedTemplateId.value, body)
    } else {
      const created = await marketingApi.createEmailTemplate(body)
      savedTemplateId.value = created.template.id
    }
    saveOpen.value = false
    toast.success('Saved to Email templates')
  } catch (error) {
    saveError.value = readFetchMessage(error, 'Could not save this design')
  } finally {
    savePending.value = false
  }
}

async function openTemplateList() {
  openOpen.value = true
  templatesError.value = ''
  templatesPending.value = true
  try {
    const res = await marketingApi.fetchEmailTemplates()
    templates.value = (res.templates || []).map((t) => ({
      id: t.id,
      name: t.name,
      subject: t.subject || ''
    }))
  } catch (error) {
    templatesError.value = readFetchMessage(error, 'Could not load templates')
  } finally {
    templatesPending.value = false
  }
}

async function loadTemplate(id: string) {
  busy.value = true
  templatesError.value = ''
  try {
    const res = await marketingApi.fetchEmailTemplateById(id)
    const html = res.template.htmlTemplate || ''
    const content = await contentFromHtml(html)
    savedTemplateId.value = res.template.id
    saveName.value = res.template.name || ''
    saveSubject.value = res.template.subject || ''
    openOpen.value = false
    await startEditor(content)
    toast.success(content?.blocks?.length ? 'Template loaded' : 'Opened as a new blank canvas')
  } catch (error) {
    templatesError.value = readFetchMessage(error, 'Could not open that template')
  } finally {
    busy.value = false
  }
}

async function newTemplate() {
  savedTemplateId.value = null
  saveName.value = ''
  saveSubject.value = ''
  await startEditor(undefined)
}

onMounted(async () => {
  const tid = queryParamString(route.query.templateId)
  if (tid) {
    try {
      const res = await marketingApi.fetchEmailTemplateById(tid)
      savedTemplateId.value = res.template.id
      saveName.value = res.template.name || ''
      saveSubject.value = res.template.subject || ''
      const content = await contentFromHtml(res.template.htmlTemplate || '')
      await startEditor(content)
      return
    } catch {
      /* fall through to blank */
    }
  }
  await startEditor(undefined)
})

onBeforeUnmount(() => {
  startToken += 1
  editor?.unmount()
  editor = null
})
</script>

<template>
  <div
    class="fixed inset-y-0 right-0 z-30 flex min-h-0 flex-col overflow-hidden bg-slate-100"
    :class="sidebarCompact ? 'left-16' : 'left-0 lg:left-72'"
  >
    <header class="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
      <div class="min-w-0">
        <h1 class="text-sm font-semibold text-slate-900">Templatical builder</h1>
        <p class="mt-0.5 truncate text-xs text-slate-500">
          Create a new email or open an existing template. Images upload to your library; type
          <span class="font-mono text-[11px]">&#123;&#123;</span> for merge tags.
        </p>
      </div>
      <div class="flex shrink-0 flex-wrap items-center gap-2">
        <button
          type="button"
          class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          :disabled="busy || status === 'loading'"
          @click="newTemplate"
        >
          New
        </button>
        <button
          type="button"
          class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          :disabled="busy || status === 'loading'"
          @click="openTemplateList"
        >
          Open
        </button>
        <button
          type="button"
          class="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          :disabled="status !== 'ready' || busy"
          @click="openSaveDialog"
        >
          Save
        </button>
      </div>
    </header>

    <div class="relative min-h-0 flex-1">
      <div
        v-if="status === 'loading' || busy"
        class="absolute inset-0 z-10 flex items-center justify-center bg-white/70"
      >
        <div class="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
      </div>
      <div
        v-else-if="status === 'error'"
        class="flex h-full flex-col items-center justify-center gap-3 px-6 text-center"
      >
        <p class="text-sm font-medium text-red-600">{{ loadError }}</p>
        <button
          type="button"
          class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          @click="startEditor()"
        >
          Retry
        </button>
      </div>
      <div ref="hostRef" class="h-full min-h-0 bg-white" style="min-height: 560px" />
    </div>

    <Teleport to="body">
      <div
        v-if="saveOpen"
        class="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
        role="dialog"
        aria-modal="true"
        @click.self="saveOpen = false"
      >
        <div class="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
          <h2 class="text-lg font-semibold text-slate-900">Save to Email templates</h2>
          <label class="mt-4 block text-sm font-medium text-slate-700" for="tpl-name">Template name</label>
          <input
            id="tpl-name"
            v-model="saveName"
            type="text"
            class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
          <label class="mt-4 block text-sm font-medium text-slate-700" for="tpl-subject">Default subject</label>
          <input
            id="tpl-subject"
            v-model="saveSubject"
            type="text"
            class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
          <p v-if="saveError" class="mt-3 text-sm text-red-600">{{ saveError }}</p>
          <div class="mt-5 flex justify-end gap-2">
            <button
              type="button"
              class="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
              :disabled="savePending"
              @click="saveOpen = false"
            >
              Cancel
            </button>
            <button
              type="button"
              class="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              :disabled="savePending"
              @click="confirmSave"
            >
              {{ savePending ? 'Saving…' : savedTemplateId ? 'Update' : 'Save' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="openOpen"
        class="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
        role="dialog"
        aria-modal="true"
        @click.self="openOpen = false"
      >
        <div class="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-xl">
          <div class="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 class="text-sm font-semibold text-slate-900">Open template</h2>
            <button type="button" class="text-sm text-slate-500 hover:text-slate-800" @click="openOpen = false">
              Close
            </button>
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto p-3">
            <p v-if="templatesPending" class="p-3 text-sm text-slate-500">Loading…</p>
            <p v-else-if="templatesError" class="p-3 text-sm text-red-600">{{ templatesError }}</p>
            <p v-else-if="!templates.length" class="p-3 text-sm text-slate-500">No templates yet.</p>
            <ul v-else class="space-y-1">
              <li v-for="t in templates" :key="t.id">
                <button
                  type="button"
                  class="w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50"
                  :disabled="busy"
                  @click="loadTemplate(t.id)"
                >
                  <span class="block text-sm font-medium text-slate-900">{{ t.name }}</span>
                  <span v-if="t.subject" class="block truncate text-xs text-slate-500">{{ t.subject }}</span>
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
