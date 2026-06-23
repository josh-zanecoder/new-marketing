import { isFullHtmlDocument } from './emailEditorHtml'
import { ensureImportedDocumentAssets } from './emailImportedAssets'
import { ensurePreviewFontAssets } from './emailPreviewFonts'
import { buildMobilePreviewActivation, stripAllViewportMeta } from './emailPreviewMobileActivation'
import {
  detectEmailResponsiveBreakpoint,
  mailViewLayoutLabel,
  resolveMailViewWidth,
  type EmailMailViewMode,
  webViewLayoutLabel,
  resolveWebViewWidth,
  type EmailWebViewMode,
  EMAIL_WEB_VIEW,
} from './emailResponsiveWebView'

export {
  detectEmailResponsiveBreakpoint,
  detectEmailResponsiveBreakpoint as detectEmailMobileBreakpoint,
  DEFAULT_EMAIL_RESPONSIVE_BREAKPOINT,
  DEFAULT_EMAIL_RESPONSIVE_BREAKPOINT as DEFAULT_EMAIL_MOBILE_BREAKPOINT,
  EMAIL_MAIL_VIEW,
  EMAIL_WEB_VIEW,
  EMAIL_MAIL_VIEW_MAX_WIDTH,
  EMAIL_MAIL_VIEW_MIN_WIDTH,
  EMAIL_WEB_VIEW_MAX_WIDTH,
  EMAIL_WEB_VIEW_MIN_WIDTH,
  isMobileMailLayout,
  isMobileWebLayout,
  mailViewLayoutLabel,
  webViewLayoutLabel,
  mailViewSliderMarks,
  webViewSliderMarks,
  resolveDesktopMailViewWidth,
  resolveDesktopWebViewWidth,
  resolveMailViewWidth,
  resolveWebViewWidth,
  resolveMobileMailViewWidth,
  resolveMobileWebViewWidth,
  type EmailMailViewMode,
  type EmailWebViewMode,
} from './emailResponsiveWebView'

export { replaceDocumentBodyInnerHtml, storeImportedFullDocumentHtml } from './storeImportedFullDocument'
export {
  ensurePreviewFontAssets,
  extractExternalStylesheetLinks,
  FONT_PRECONNECT_TAGS,
} from './emailPreviewFonts'
export {
  ensureImportedDocumentAssets,
  extractHeadScriptTagsFromHtml,
  extractStyleTagsFromHtml,
  mergeImportHeadAssets,
} from './emailImportedAssets'

export function stripViewportMeta(html: string): string {
  return stripAllViewportMeta(html)
}

function injectAtHeadStart(html: string, injection: string): string {
  if (/<head\b/i.test(html)) {
    return html.replace(/<head(\b[^>]*)>/i, `<head$1>${injection}`)
  }
  if (html.includes('</head>')) {
    return html.replace('</head>', `${injection}</head>`)
  }
  return `<!DOCTYPE html><html><head>${injection}</head><body>${html}</body></html>`
}

function injectBeforeHeadEnd(html: string, injection: string): string {
  if (html.includes('</head>')) {
    return html.replace('</head>', `${injection}</head>`)
  }
  return injectAtHeadStart(html, injection)
}

function injectViewportForPreview(html: string, previewWidth: number, mobileLayout: boolean): string {
  const withoutViewport = stripAllViewportMeta(html)
  const viewportTag = mobileLayout
    ? `<meta name="viewport" content="width=device-width, initial-scale=1.0">`
    : `<meta name="viewport" content="width=${Math.max(280, Math.round(previewWidth))}, initial-scale=1.0">`
  return injectAtHeadStart(withoutViewport, viewportTag)
}

function ensureFullDocument(html: string): string {
  const trimmed = html.trim()
  if (!trimmed) return trimmed
  if (isFullHtmlDocument(trimmed)) return trimmed
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head><body>${trimmed}</body></html>`
}

export type ImportedEmailIframeOptions = {
  previewWidth?: number | null
  /** Editor bridge `<script>` / `<style>` injected before `</head>` (edit tab only). */
  editorHeadInjection?: string
}

/**
 * Build the full HTML document for preview/edit iframes.
 * Preserves imported HTML, CSS, and JS; adds viewport + mobile activation layers only.
 */
export function buildImportedEmailIframeDocument(
  html: string,
  options: ImportedEmailIframeOptions = {}
): string {
  let doc = ensureFullDocument(html.trim())
  doc = ensureImportedDocumentAssets(doc)
  doc = ensurePreviewFontAssets(doc)

  const editorInjection = options.editorHeadInjection?.trim()
  if (editorInjection) {
    doc = injectBeforeHeadEnd(doc, editorInjection)
  }

  const previewWidth = options.previewWidth
  if (previewWidth == null || !Number.isFinite(previewWidth)) {
    return doc
  }

  const width = Math.max(280, Math.round(previewWidth))
  const breakpoint = detectEmailResponsiveBreakpoint(doc)
  const mobileLayout = width <= breakpoint

  doc = injectViewportForPreview(doc, width, mobileLayout)

  if (mobileLayout) {
    doc = injectBeforeHeadEnd(doc, buildMobilePreviewActivation(doc, width))
  }

  return ensurePreviewFontAssets(doc)
}

/**
 * Prepare HTML for iframe preview.
 * Viewport matches mail-view width; native template @media + a small reinforce layer on mobile.
 */
export function prepareEmailHtmlForPreviewIframe(
  html: string,
  previewWidth?: number | null,
  editorHeadInjection?: string
): string {
  return buildImportedEmailIframeDocument(html, { previewWidth, editorHeadInjection })
}

export function campaignEmailPreviewSrcdoc(html: string, previewWidth?: number | null): string {
  return prepareEmailHtmlForPreviewIframe(html, previewWidth ?? null)
}

export function responsiveLayoutLabel(previewWidth: number, html: string): string {
  return webViewLayoutLabel(previewWidth, html)
}

export function prepareWebViewPreviewHtml(html: string, mode: EmailWebViewMode): string {
  return prepareEmailHtmlForPreviewIframe(html, resolveWebViewWidth(mode, html))
}

/** @deprecated Use prepareWebViewPreviewHtml */
export function prepareMailViewPreviewHtml(html: string, mode: EmailMailViewMode): string {
  return prepareWebViewPreviewHtml(html, mode)
}

export function createEmailPreviewBlobUrl(html: string): string {
  return URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
}
