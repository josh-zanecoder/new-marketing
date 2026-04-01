<script setup lang="ts">
import type { Editor } from 'grapesjs'
import { mergeMustacheTemplate } from '~/utils/emailTemplateMerge'

definePageMeta({
  layout: false
})

const DEFAULT_EMAIL_TEMPLATE = `
<table class="email-wrapper" style="width:100%;background:linear-gradient(135deg,#f8f4ef 0%,#f0e8df 100%);padding:32px 16px;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;">
  <tr><td align="center" style="padding:0;">
    <table class="email-container" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(63,38,16,0.08);">
      <tr>
        <td class="header" style="background:linear-gradient(90deg,#2d2a26 0%,#3d3834 100%);padding:28px 40px;text-align:center;">
          <table style="width:100%;"><tr><td style="font-size:22px;font-weight:600;color:#fffdfb;letter-spacing:0.5px;">Your Brand</td></tr><tr><td style="font-size:12px;color:rgba(255,253,251,0.7);padding-top:4px;">Newsletter</td></tr></table>
        </td>
      </tr>
      <tr>
        <td class="hero" style="padding:48px 40px 40px;text-align:center;background:#fffdfb;">
          <h1 style="margin:0 0 16px;font-size:28px;font-weight:700;color:#2d2a26;line-height:1.3;">Welcome to Our Newsletter</h1>
          <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#5c5349;">Discover tips, updates, and exclusive content delivered straight to your inbox.</p>
          <a href="#" class="cta-btn" style="display:inline-block;padding:14px 32px;background:#2d2a26;color:#fffdfb;text-decoration:none;font-size:14px;font-weight:600;border-radius:8px;">Get Started</a>
        </td>
      </tr>
      <tr>
        <td class="divider" style="height:1px;background:#f0e1d4;padding:0;"></td>
      </tr>
      <tr>
        <td class="content" style="padding:40px;">
          <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#2d2a26;">What to expect</h2>
          <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#5c5349;">• Weekly insights and industry updates</p>
          <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#5c5349;">• Exclusive offers and early access</p>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#5c5349;">• Tips to help you succeed</p>
        </td>
      </tr>
      <tr>
        <td class="footer" style="background:#f8f4ef;padding:24px 40px;text-align:center;">
          <p style="margin:0 0 8px;font-size:12px;color:#8a7f73;">© 2025 Your Brand. All rights reserved.</p>
          <p style="margin:0;font-size:11px;color:#a89f95;"><a href="#" style="color:#8a7f73;">Unsubscribe</a> · <a href="#" style="color:#8a7f73;">Preferences</a></p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
<style>.email-wrapper{width:100%;min-height:100vh;}.cta-btn:hover{background:#3d3834 !important;}</style>
`

const route = useRoute()
const editorContainerRef = ref<HTMLDivElement | null>(null)
const editorRef = ref<Editor | null>(null)
const initialHtml = ref<string | null>(null)
const htmlReady = ref(false)
const isMounted = ref(false)
const editorInitInFlight = ref(false)
let editorInitToken = 0
let blockSyncTimer: ReturnType<typeof setTimeout> | null = null
let editorCleanupFns: Array<() => void> = []

function logEditorCrash(stage: string, details?: unknown) {
  console.error('[EmailEditor][Crash]', {
    stage,
    route: typeof route.fullPath === 'string' ? route.fullPath : '',
    campaignId: campaignId.value || null,
    builderId: builderId.value || null,
    tenantId: resolvedTenantId.value || null,
    details
  })
}

const DYN_VAR_BLOCK_PREFIX = 'email-dyn-var-'

interface DynamicVariableItem {
  id: string
  key: string
  label: string
  sourceType?: 'recipient' | 'user'
  scopes?: Array<'subject' | 'body'>
  enabled?: boolean
}

const dynamicVariables = ref<DynamicVariableItem[]>([])

function queryParamString(q: unknown): string {
  if (q == null) return ''
  if (Array.isArray(q)) return typeof q[0] === 'string' ? q[0] : ''
  return typeof q === 'string' ? q : String(q)
}

const htmlFromUrl = computed(() => queryParamString(route.query.html))
const builderId = computed(() => queryParamString(route.query.builderId))
const campaignId = computed(() => queryParamString(route.query.campaignId))
const tenantIdFromQuery = computed(() => queryParamString(route.query.tenantId))
const resolvedTenantId = ref('')

function pickTenantId(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const obj = payload as Record<string, unknown>
  const direct = obj.tenantId
  if (typeof direct === 'string' && direct.trim()) return direct.trim()
  const me = obj.me
  if (me && typeof me === 'object') {
    const nested = (me as Record<string, unknown>).tenantId
    if (typeof nested === 'string' && nested.trim()) return nested.trim()
  }
  const data = obj.data
  if (data && typeof data === 'object') {
    const nested = (data as Record<string, unknown>).tenantId
    if (typeof nested === 'string' && nested.trim()) return nested.trim()
  }
  return ''
}

async function resolveTenantId() {
  if (tenantIdFromQuery.value) {
    resolvedTenantId.value = tenantIdFromQuery.value
    return
  }
  try {
    const res = await $fetch<unknown>('/api/v1/tenant/me')
    const id = pickTenantId(res)
    resolvedTenantId.value = id || ''
  } catch {
    resolvedTenantId.value = ''
  }
}

async function loadDynamicVariables() {
  try {
    const res = await $fetch<{ variables: DynamicVariableItem[] }>(
      '/api/v1/tenant/dynamic-variables'
    )
    dynamicVariables.value = res.variables ?? []
  } catch {
    dynamicVariables.value = []
  }
}

function tokenFor(v: DynamicVariableItem) {
  return `{{${v.key}}}`
}

function variableCategory(v: DynamicVariableItem) {
  if (v.sourceType === 'user') return 'User variables'
  if (v.sourceType === 'recipient') return 'Recipient variables'
  if (/^user\./i.test(v.key)) return 'User variables'
  return 'Recipient variables'
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function isTextEditingTarget(target: EventTarget | null): boolean {
  const el = target as Partial<HTMLElement> | null
  if (!el || typeof el !== 'object') return false
  const tag = el.tagName?.toLowerCase() || ''
  if (tag === 'input' || tag === 'textarea') return true
  if (el.isContentEditable === true) return true
  if (typeof el.closest !== 'function') return false
  return Boolean(el.closest('[contenteditable="true"]'))
}

function syncDynamicVariableBlocks(editor: Editor, list: DynamicVariableItem[]) {
  const bm = editor.BlockManager
  const coll = bm.getAll() as {
    each?: (fn: (block: { get(k: string): string }) => void) => void
    models?: Array<{ get(k: string): string }>
  }
  const toRemove: string[] = []
  if (typeof coll.each === 'function') {
    coll.each((block) => {
      const id = block.get('id')
      if (id?.startsWith(DYN_VAR_BLOCK_PREFIX)) toRemove.push(id)
    })
  } else if (coll.models) {
    for (const block of coll.models) {
      const id = block.get('id')
      if (id?.startsWith(DYN_VAR_BLOCK_PREFIX)) toRemove.push(id)
    }
  }
  for (const id of toRemove) bm.remove(id)

  const mergeMedia =
    '<div style="font-size:22px;font-weight:800;letter-spacing:-0.06em;line-height:1;color:currentColor">{{}}</div>'
  let addedCount = 0

  for (const v of list) {
    if (v.enabled === false) continue
    if (v.scopes?.length && !v.scopes.includes('body')) continue

    const token = tokenFor(v)
    const id = `${DYN_VAR_BLOCK_PREFIX}${v.id}`
    bm.add(id, {
      label: v.label,
      category: variableCategory(v),
      media: mergeMedia,
      attributes: { title: `${token} — ${v.label}` },
      content: `<span style="display:inline;">${token}</span>`
    })
    addedCount += 1
  }

  if (addedCount === 0) {
    const tid = resolvedTenantId.value.trim()
    const shortId = tid ? tid.slice(-8) : ''
    const title = tid
      ? `Tenant ID ${tid}. None configured yet — add them in Admin › Tenants › Dynamic variables.`
      : 'Sign in as a tenant user or open this page with ?tenantId=… so your tenant can be resolved.'
    const body = tid
      ? `No merge fields for your tenant yet. ID: ${tid}`
      : 'Tenant could not be resolved — dynamic variables were not loaded.'
    bm.add(`${DYN_VAR_BLOCK_PREFIX}empty`, {
      label: tid ? `No variables · …${shortId}` : 'No tenant context',
      category: 'Dynamic variables',
      media: mergeMedia,
      attributes: { title },
      content: `<p style="margin:0;font-size:12px;line-height:1.45;color:#64748b">${escapeHtml(body)}</p>`
    })
  }

  bm.render()
}

function queueDynamicVariableBlocksSync() {
  if (blockSyncTimer) clearTimeout(blockSyncTimer)
  blockSyncTimer = setTimeout(() => {
    blockSyncTimer = null
    const editor = editorRef.value
    if (!editor) return
    try {
      syncDynamicVariableBlocks(editor, dynamicVariables.value)
    } catch (err) {
      logEditorCrash('dynamic-variable-blocks.sync', err)
    }
  }, 120)
}

function hardenTextBlocks(editor: Editor) {
  const bm = editor.BlockManager
  const textBlock = bm.get('text')
  if (!textBlock) return
  textBlock.set({
    activate: false,
    content: `
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td style="padding:10px 0;color:#334155;font-size:14px;line-height:1.6;" data-gjs-type="text">
            Add your text here
          </td>
        </tr>
      </table>
    `
  })
}

function runEditorCleanups() {
  for (const fn of editorCleanupFns) {
    try {
      fn()
    } catch {
      /* cleanup failed */
    }
  }
  editorCleanupFns = []
}

function destroyEditorInstance() {
  if (blockSyncTimer) {
    clearTimeout(blockSyncTimer)
    blockSyncTimer = null
  }
  runEditorCleanups()
  if (editorRef.value) {
    editorRef.value.destroy()
    editorRef.value = null
  }
}

watch([editorRef, dynamicVariables], () => {
  const editor = editorRef.value
  if (!editor) return
  queueDynamicVariableBlocksSync()
})

const mergePreviewOpen = ref(false)
const mergePreviewSrcdoc = ref('')

function mergePreviewSrcdocHtml(html: string, scale = 0.85): string {
  return `<!DOCTYPE html><html><head><meta charset=utf-8><style>
*{box-sizing:border-box}
body{margin:0;padding:24px;overflow:auto;background:linear-gradient(135deg,#f8f4ef 0%,#f0e8df 100%);min-height:100%}
#preview-merge-wrap{transform:scale(${scale});transform-origin:center top;width:600px;margin:0 auto}
</style></head><body><div id=preview-merge-wrap>${html}</div></body></html>`
}

async function openMergePreview() {
  const editor = editorRef.value
  if (!editor) return
  const cid = campaignId.value
  let root: Record<string, unknown> = {}
  if (cid && /^[a-f0-9]{24}$/i.test(cid)) {
    try {
      const r = await $fetch<{ mergeRoot: Record<string, unknown> }>('/api/v1/tenant/email/merge-root', {
        method: 'POST',
        body: { campaignId: cid },
        credentials: 'include'
      })
      root = r.mergeRoot ?? {}
    } catch {
      root = {}
    }
  }
  const html = editor.getHtml()
  const css = editor.getCss()
  const merged = mergeMustacheTemplate(`<style>${css}</style>${html}`, root)
  mergePreviewSrcdoc.value = mergePreviewSrcdocHtml(merged)
  mergePreviewOpen.value = true
}

function closeMergePreview() {
  mergePreviewOpen.value = false
}

onMounted(() => {
  isMounted.value = true
  resolveTenantId().then(loadDynamicVariables)
})

watch(tenantIdFromQuery, () => {
  resolveTenantId().then(loadDynamicVariables)
})

watch([isMounted, htmlFromUrl, builderId, campaignId], () => {
  if (!isMounted.value) return

  let resolved: string | null = null

  if (htmlFromUrl.value) {
    try {
      resolved = decodeURIComponent(htmlFromUrl.value)
    } catch {
      /* invalid query encoding */
    }
  }

  if (!resolved && builderId.value && typeof window !== 'undefined') {
    try {
      const stored = window.sessionStorage.getItem(builderId.value)
      if (stored) {
        resolved = stored
        window.sessionStorage.removeItem(builderId.value)
      }
    } catch {
      /* sessionStorage blocked or unavailable */
    }
  }

  if (!resolved && campaignId.value && typeof window !== 'undefined') {
    try {
      const stored = window.sessionStorage.getItem(`campaign-template-${campaignId.value}`)
      if (stored) resolved = stored
    } catch {
      /* sessionStorage blocked or unavailable */
    }
  }

  initialHtml.value = resolved
  htmlReady.value = true
}, { immediate: true })

watch([isMounted, htmlReady], async () => {
  if (!isMounted.value || !htmlReady.value) return
  if (editorRef.value || editorInitInFlight.value) return

  editorInitInFlight.value = true
  const token = ++editorInitToken

  try {
    await nextTick()
    if (token !== editorInitToken) return
    if (!editorContainerRef.value) return

    destroyEditorInstance()

    const [grapesjsModule, presetModule] = await Promise.all([
      import('grapesjs'),
      import('grapesjs-preset-newsletter')
    ])
    if (token !== editorInitToken) return

    const grapesjs = grapesjsModule.default
    const presetNewsletter = presetModule.default

    if (!editorContainerRef.value) return

    const editor = grapesjs.init({
      height: '100%',
      width: 'auto',
      storageManager: false,
      container: editorContainerRef.value,
      fromElement: false,
      noticeOnUnload: false,
      plugins: [
        (editorInstance: Editor) =>
          presetNewsletter(editorInstance, {
            modalLabelImport: 'Paste all your code here below and click import',
            modalLabelExport: 'Copy the code and use it wherever you want',
            importPlaceholder: '<table class="table"><tr><td class="cell">Hello world!</td></tr></table>',
            cellStyle: {
              'font-size': '12px',
              'font-weight': '300',
              'vertical-align': 'top',
              color: 'rgb(111, 119, 125)',
              margin: '0',
              padding: '0'
            },
            inlineCss: true,
            updateStyleManager: true,
            showStylesOnChange: true,
            showBlocksOnLoad: true,
            useCustomTheme: true,
            textCleanCanvas: 'Are you sure you want to clear the canvas?'
          })
      ]
    })
    editorCleanupFns.push(() => {
      try {
        editor.stopCommand?.('*')
      } catch {
        /* noop */
      }
    })

    editor.Commands.add('save-and-exit', {
      run: () => {
        try {
          const html = editor.getHtml()
          const css = editor.getCss()
          const fullHtml = `<style>${css}</style>${html}`
          let targetId = campaignId.value
          if (typeof window !== 'undefined') {
            if (campaignId.value) {
              window.sessionStorage.setItem(`campaign-template-${campaignId.value}`, fullHtml)
            } else if (builderId.value) {
              targetId = `temp-${Date.now()}`
              window.sessionStorage.setItem(`campaign-template-${targetId}`, fullHtml)
              window.sessionStorage.setItem('mortdash-pending-campaign', JSON.stringify({
                form: { name: '', senderName: '', senderEmail: '', subject: '', recipientsMode: 'list', recipientsListId: '', recipientsManual: [''], templateMode: 'scratch', selectedTemplateId: '' },
                campaignId: targetId
              }))
            }
          }
          const isRealId = targetId && /^[a-f0-9]{24}$/i.test(targetId)
          const url = targetId
            ? `/tenant/campaigns/add?campaignId=${targetId}&fromEditor=1${isRealId ? `&id=${targetId}` : ''}`
            : '/tenant/campaigns'
          navigateTo(url)
        } catch {
          /* navigation / storage failed */
        }
      }
    })

    editor.Commands.add('save-to-device', {
      run: () => {
        try {
          const html = editor.getHtml()
          const css = editor.getCss()
          const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Template</title>
  <style>${css}</style>
</head>
<body>
${html}
</body>
</html>`
          const blob = new Blob([fullHtml], { type: 'text/html' })
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = `email-template-${Date.now()}.html`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(url)
        } catch {
          /* download failed */
        }
      }
    })

    editor.onReady(() => {
      const onWindowError = (ev: ErrorEvent) => {
        logEditorCrash('window.error', {
          message: ev.message,
          filename: ev.filename,
          lineno: ev.lineno,
          colno: ev.colno,
          error: ev.error instanceof Error ? ev.error.stack || ev.error.message : ev.error
        })
      }
      const onUnhandledRejection = (ev: PromiseRejectionEvent) => {
        logEditorCrash('window.unhandledrejection', {
          reason:
            ev.reason instanceof Error
              ? ev.reason.stack || ev.reason.message
              : String(ev.reason)
        })
      }
      window.addEventListener('error', onWindowError)
      window.addEventListener('unhandledrejection', onUnhandledRejection)
      editorCleanupFns.push(() => {
        window.removeEventListener('error', onWindowError)
        window.removeEventListener('unhandledrejection', onUnhandledRejection)
      })

      const frameDoc = editor.Canvas?.getDocument?.()
      if (frameDoc) {
        const onFrameKeydown = (e: KeyboardEvent) => {
          if (!(e.ctrlKey || e.metaKey)) return
          if (e.key.toLowerCase() !== 'a') return
          // Keep Cmd/Ctrl+A scoped to text editing instead of GrapesJS global select-all.
          if (!isTextEditingTarget(e.target)) return
          e.stopPropagation()
        }
        frameDoc.addEventListener('keydown', onFrameKeydown, true)
        editorCleanupFns.push(() => {
          frameDoc.removeEventListener('keydown', onFrameKeydown, true)
        })
      }

      const panels = editor.Panels
      const optionsPanel = panels.getPanel('options')
      if (optionsPanel) {
        panels.addButton('options', {
          id: 'save-to-device',
          label: '<svg style="display:block;max-width:22px" viewBox="0 0 24 24"><path fill="currentColor" d="M5,20H19V18H5M19,11H15V17H9V11H5L12,4L19,11Z"/></svg>',
          command: 'save-to-device',
          attributes: { title: 'Save to Device' }
        })
      }
      hardenTextBlocks(editor)
      if (initialHtml.value) {
        try {
          editor.setComponents(initialHtml.value)
        } catch {
          editor.setComponents(DEFAULT_EMAIL_TEMPLATE)
        }
      } else {
        editor.setComponents(DEFAULT_EMAIL_TEMPLATE)
      }

      queueDynamicVariableBlocksSync()
    })
    editor.on('error', (err: unknown) => {
      logEditorCrash('grapesjs.error', err)
    })

    editorRef.value = editor
  } catch (err) {
    logEditorCrash('editor.init', err)
  } finally {
    if (token === editorInitToken) {
      editorInitInFlight.value = false
    }
  }
}, { immediate: true })

onBeforeUnmount(() => {
  editorInitToken += 1
  editorInitInFlight.value = false
  destroyEditorInstance()
})

function handleSaveAndExit() {
  if (!editorRef.value) return
  try {
    const html = editorRef.value.getHtml()
    const css = editorRef.value.getCss()
    const fullHtml = `<style>${css}</style>${html}`
    let targetId = campaignId.value
    if (typeof window !== 'undefined') {
      if (campaignId.value) {
        window.sessionStorage.setItem(`campaign-template-${campaignId.value}`, fullHtml)
      } else if (builderId.value) {
        targetId = `temp-${Date.now()}`
        window.sessionStorage.setItem(`campaign-template-${targetId}`, fullHtml)
        window.sessionStorage.setItem('mortdash-pending-campaign', JSON.stringify({
          form: { name: '', senderName: '', senderEmail: '', subject: '', recipientsMode: 'list', recipientsListId: '', recipientsManual: [''], templateMode: 'scratch', selectedTemplateId: '' },
          campaignId: targetId
        }))
      }
    }
    const isRealId = targetId && /^[a-f0-9]{24}$/i.test(targetId)
    const url = targetId
      ? `/tenant/campaigns/add?campaignId=${targetId}&fromEditor=1${isRealId ? `&id=${targetId}` : ''}`
      : '/tenant/campaigns'
    navigateTo(url)
  } catch {
    /* save / navigation failed */
  }
}
</script>

<template>
  <ClientOnly>
    <div v-if="!isMounted" class="flex h-screen items-center justify-center bg-slate-100">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
    </div>
    <div v-else class="flex h-screen flex-col">
      <div
        class="flex shrink-0 items-center justify-end gap-2 border-b border-slate-200 bg-slate-800 px-4 py-2.5"
      >
        <button
          v-if="campaignId && /^[a-f0-9]{24}$/i.test(campaignId)"
          type="button"
          class="rounded-lg border border-slate-500 bg-transparent px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          @click="openMergePreview"
        >
          Preview with merge data
        </button>
        <button
          type="button"
          class="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
          @click="handleSaveAndExit"
        >
          Save and exit
        </button>
      </div>
      <Teleport to="body">
        <div
          v-if="mergePreviewOpen"
          class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Merged email preview"
          @click.self="closeMergePreview"
        >
          <div
            class="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
          >
            <div class="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
              <span class="text-sm font-semibold text-slate-800">Preview (user + recipient from Contacts)</span>
              <button
                type="button"
                class="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                aria-label="Close preview"
                @click="closeMergePreview"
              >
                Close
              </button>
            </div>
            <iframe
              v-if="mergePreviewSrcdoc"
              class="min-h-[70vh] w-full flex-1 border-0 bg-slate-100"
              title="Merged email preview"
              :srcdoc="mergePreviewSrcdoc"
            />
          </div>
        </div>
      </Teleport>
      <div
        ref="editorContainerRef"
        class="min-h-0 flex-1 overflow-auto"
        style="height: calc(100vh - 52px)"
      />
    </div>
    <template #fallback>
      <div class="flex h-screen items-center justify-center bg-slate-100">
        <div class="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
      </div>
    </template>
  </ClientOnly>
</template>
