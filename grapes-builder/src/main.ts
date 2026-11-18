import grapesjs from 'grapesjs'
import type { Editor } from 'grapesjs'
import newsletterModule from 'grapesjs-preset-newsletter'
import 'grapesjs/dist/css/grapes.min.css'
import './style.css'
import { CHANNEL, isHostMessage, postToHost } from './protocol'
import { deserializeEmailEditorHtml, serializeEmailEditorHtml } from './emailHtml'
import { setupGrapesEmailImageRow } from '../../shared/utils/grapesEmailImageRow'

/** CJS/ESM interop: preset may be nested under `.default` a few times. */
function resolvePluginFn(
  mod: unknown
): ((editor: Editor, opts?: Record<string, unknown>) => void) | null {
  let current = mod
  for (let i = 0; i < 4; i += 1) {
    if (typeof current === 'function') {
      return current as (editor: Editor, opts?: Record<string, unknown>) => void
    }
    if (!current || typeof current !== 'object' || !('default' in current)) return null
    current = (current as { default: unknown }).default
  }
  return null
}

const newsletter = resolvePluginFn(newsletterModule)

const PLACEHOLDER =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="240" viewBox="0 0 640 240">' +
      '<rect width="640" height="240" fill="#e2e8f0"/>' +
      '<text x="320" y="125" text-anchor="middle" fill="#64748b" font-family="sans-serif" font-size="20">Double-click to choose saved image</text>' +
      '</svg>'
  )

const DEFAULT_HTML = `<table class="email-wrapper" width="100%" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;background:#f1f5f9;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
  <tr>
    <td align="center" style="padding:0;">
      <table class="email-container" width="600" cellpadding="0" cellspacing="0" role="presentation" style="width:600px;max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr>
          <td class="header" style="background:#0f172a;padding:28px 40px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.3px;">Your Brand</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.72);padding-top:6px;">Newsletter</div>
          </td>
        </tr>
        <tr>
          <td class="hero-image" style="padding:0;line-height:0;">
            <img src="${PLACEHOLDER}" alt="Hero image" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;" />
          </td>
        </tr>
        <tr>
          <td class="hero" style="padding:40px 40px 32px;text-align:center;background:#ffffff;">
            <h1 style="margin:0 0 14px;font-size:28px;font-weight:700;color:#0f172a;line-height:1.3;">Welcome to our newsletter</h1>
            <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#475569;">Share updates, tips, and offers with a clear headline and call to action.</p>
            <a href="#" class="cta-btn" style="display:inline-block;padding:14px 28px;background:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;border-radius:8px;">Get started</a>
          </td>
        </tr>
        <tr>
          <td style="height:1px;background:#e2e8f0;padding:0;font-size:0;line-height:0;">&nbsp;</td>
        </tr>
        <tr>
          <td class="content" style="padding:36px 40px;">
            <h2 style="margin:0 0 14px;font-size:20px;font-weight:700;color:#0f172a;">What’s inside</h2>
            <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#475569;">• A short update your readers care about</p>
            <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#475569;">• A useful tip or resource</p>
            <p style="margin:0;font-size:15px;line-height:1.6;color:#475569;">• A clear next step</p>
          </td>
        </tr>
        <tr>
          <td class="footer" style="background:#f8fafc;padding:24px 40px;text-align:center;">
            <p style="margin:0 0 8px;font-size:12px;color:#64748b;">© Your Brand. All rights reserved.</p>
            <p style="margin:0;font-size:11px;color:#94a3b8;">
              <a href="{{unsubscribe}}" style="color:#64748b;text-decoration:underline;">Unsubscribe</a>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`

type Meta = { name: string; subject: string; templateId: string | null }

const meta: Meta = { name: '', subject: '', templateId: null }
const pendingUploads = new Map<
  string,
  { resolve: (url: string) => void; reject: (err: Error) => void }
>()
const pendingPicks = new Map<
  string,
  {
    resolve: (value: { url: string; fileName: string } | null) => void
  }
>()

const statusEl = document.getElementById('status')
const chromeEl = document.getElementById('chrome')
const btnNew = document.getElementById('btn-new')
const btnSave = document.getElementById('btn-save')
const embedded =
  window.parent !== window || new URLSearchParams(window.location.search).get('embed') === '1'

if (embedded) {
  document.documentElement.classList.add('is-embedded')
  chromeEl?.setAttribute('hidden', '')
}

function showStatus(message: string) {
  if (!statusEl) return
  statusEl.hidden = !message
  statusEl.textContent = message
}

function exportHtml(editor: Editor): string {
  // Match Marketing Grapes export: keep ids, unused CSS, full HTML document for Mongo.
  const html = editor.getHtml({ cleanId: false }) || ''
  const css = editor.getCss({ keepUnusedStyles: true }) || ''
  return serializeEmailEditorHtml(html, css)
}

function setCanvasHtml(editor: Editor, html: string) {
  const trimmed = (html || '').trim()
  if (!trimmed) {
    editor.setComponents(DEFAULT_HTML)
    return
  }
  // Mongo stores full documents; Grapes needs body + styles only.
  editor.setComponents(deserializeEmailEditorHtml(trimmed))
}

/**
 * Avoid Grapes Asset Manager / onLoad refresh loops that crash Nuxt.
 * Image clicks open a normal OS file picker; upload is delegated to Marketing.
 */
function setupSafeImages(editor: Editor) {
  editor.DomComponents.addType('image', {
    extend: 'image',
    model: {
      defaults: {
        traits: ['alt', 'title'],
        attributes: { src: PLACEHOLDER, alt: 'Image' }
      }
    },
    view: {
      onLoad() {
        /* no Canvas.refresh — that loop crashes the host when inlined */
      },
      onActive(this: { model: { get: (k: string) => unknown } }) {
        void pickAndUpload(editor, this.model)
      }
    }
  })

  const blocks = editor.BlockManager
  const imageBlock = blocks.get('image')
  if (imageBlock) {
    imageBlock.set({
      activate: false,
      select: true,
      content: {
        type: 'image',
        attributes: { src: PLACEHOLDER, alt: 'Image' },
        style: { width: '100%', height: 'auto', 'max-width': '100%' }
      }
    })
  }

  // Never open Grapes Asset Manager UI.
  editor.Commands.add('open-assets', {
    run(ed) {
      void pickAndUpload(ed, ed.getSelected())
    }
  })
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Could not read that file'))
    reader.readAsDataURL(file)
  })
}

function requestHostLibraryImage(): Promise<{ url: string; fileName: string } | null> {
  const requestId = `pick_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      pendingPicks.delete(requestId)
      resolve(null)
    }, 120000)
    pendingPicks.set(requestId, {
      resolve: (value) => {
        window.clearTimeout(timer)
        resolve(value)
      }
    })
    postToHost({
      channel: CHANNEL,
      type: 'pick-image-request',
      requestId
    })
  })
}

function applyImageSrc(
  editor: Editor,
  target: unknown,
  url: string,
  fileName: string
) {
  const model = target as {
    get?: (k: string) => unknown
    addAttributes?: (attrs: Record<string, string>) => void
    addStyle?: (style: Record<string, string>) => void
  } | null
  if (model?.get?.('type') === 'image' && model.addAttributes) {
    model.addAttributes({ src: url, alt: fileName || 'Image' })
    model.addStyle?.({ width: '100%', height: 'auto', 'max-width': '100%' })
    return
  }
  editor.addComponents({
    type: 'image',
    attributes: { src: url, alt: fileName || 'Image' },
    style: { width: '100%', height: 'auto', 'max-width': '100%' }
  })
}

async function pickAndUpload(editor: Editor, target: unknown) {
  showStatus('')
  try {
    // Embedded in Marketing: pick from saved Images library.
    if (window.parent && window.parent !== window) {
      const picked = await requestHostLibraryImage()
      if (!picked?.url) return
      applyImageSrc(editor, target, picked.url, picked.fileName || 'Image')
      return
    }

    // Standalone: local file → data URL.
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.style.display = 'none'
    document.body.appendChild(input)
    const file = await new Promise<File | null>((resolve) => {
      input.onchange = () => resolve(input.files?.[0] || null)
      input.oncancel = () => resolve(null)
      input.click()
    })
    input.remove()
    if (!file) return
    const dataUrl = await readFileAsDataUrl(file)
    applyImageSrc(editor, target, dataUrl, file.name)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not add that image'
    showStatus(message)
  }
}

function createEditor(): Editor {
  const editor = grapesjs.init({
    container: '#gjs',
    height: '100%',
    width: 'auto',
    fromElement: false,
    storageManager: false,
    noticeOnUnload: false,
    canvas: { frameContent: '' },
    assetManager: {
      embedAsBase64: false,
      autoAdd: false,
      upload: false
    },
    plugins: newsletter
      ? [
          (ed) => {
            newsletter(ed, {
              modalLabelImport: 'Paste HTML',
              modalLabelExport: 'Export HTML',
              importPlaceholder: '<table><tr><td>Hello</td></tr></table>',
              showBlocksOnLoad: true,
              inlineCss: false
            })
          }
        ]
      : []
  })

  setupSafeImages(editor)
  setupGrapesEmailImageRow(editor, { placeholderSrc: PLACEHOLDER })
  setCanvasHtml(editor, DEFAULT_HTML)
  return editor
}

const editor = createEditor()

function resetBlank() {
  meta.templateId = null
  meta.name = ''
  meta.subject = ''
  setCanvasHtml(editor, DEFAULT_HTML)
  showStatus('')
}

function emitSave() {
  const html = exportHtml(editor)
  if (window.parent && window.parent !== window) {
    postToHost({
      channel: CHANNEL,
      type: 'save',
      html,
      name: meta.name,
      subject: meta.subject,
      templateId: meta.templateId
    })
    return
  }
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${meta.name || 'email'}.html`
  a.click()
  URL.revokeObjectURL(url)
}

window.addEventListener('error', (event) => {
  postToHost({
    channel: CHANNEL,
    type: 'crash',
    message: event.message || 'Builder crashed'
  })
})

window.addEventListener('message', (event) => {
  if (!isHostMessage(event.data)) return
  const msg = event.data
  if (msg.type === 'load') {
    meta.name = msg.name || ''
    meta.subject = msg.subject || ''
    meta.templateId = msg.templateId ?? null
    setCanvasHtml(editor, msg.html || DEFAULT_HTML)
    showStatus('')
    return
  }
  if (msg.type === 'ping') {
    postToHost({ channel: CHANNEL, type: 'ready' })
    return
  }
  if (msg.type === 'new') {
    resetBlank()
    return
  }
  if (msg.type === 'request-save') {
    emitSave()
    return
  }
  if (msg.type === 'upload-result') {
    const pending = pendingUploads.get(msg.requestId)
    if (!pending) return
    pendingUploads.delete(msg.requestId)
    if (msg.url) pending.resolve(msg.url)
    else pending.reject(new Error(msg.error || 'Upload failed'))
    return
  }
  if (msg.type === 'pick-image-result') {
    const pending = pendingPicks.get(msg.requestId)
    if (!pending) return
    pendingPicks.delete(msg.requestId)
    if (msg.cancelled || msg.error || !msg.url) {
      pending.resolve(null)
      if (msg.error) showStatus(msg.error)
      return
    }
    pending.resolve({ url: msg.url, fileName: msg.fileName || 'Image' })
  }
})

btnNew?.addEventListener('click', () => resetBlank())
btnSave?.addEventListener('click', () => emitSave())

postToHost({ channel: CHANNEL, type: 'ready' })
// Host may attach its listener after the first ready (iframe load race).
window.setTimeout(() => postToHost({ channel: CHANNEL, type: 'ready' }), 250)
window.setTimeout(() => postToHost({ channel: CHANNEL, type: 'ready' }), 1000)
