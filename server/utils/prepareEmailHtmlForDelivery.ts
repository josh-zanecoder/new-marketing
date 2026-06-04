import juice from 'juice'

const DESKTOP_HIDE_INLINE =
  'mso-hide:all;display:none;max-height:0;overflow:hidden;'

const JUICE_OPTIONS = {
  preserveMediaQueries: true,
  preserveFontFaces: true,
  preserveImportant: true,
  applyWidthAttributes: true,
  applyHeightAttributes: true,
  applyAttributesTableElements: true,
  removeStyleTags: false
}

function appendInlineStyle(attrs: string, extra: string): string {
  const styleRe = /\bstyle="([^"]*)"/i
  if (styleRe.test(attrs)) {
    return attrs.replace(styleRe, (_, cur: string) => `style="${extra}${cur}"`)
  }
  return `${attrs} style="${extra}"`
}

function ensureDesktopHideInline(html: string): string {
  return html.replace(
    /<(\w+)([^>]*\bclass="[^"]*\bdesktop_hide\b[^"]*"[^>]*)>/gi,
    (_match, tag: string, attrs: string) =>
      `<${tag}${appendInlineStyle(attrs, DESKTOP_HIDE_INLINE)}>`
  )
}

function wrapHtmlDocument(html: string): { document: string; unwrapBody: boolean } {
  const trimmed = html.trim()
  if (/^\s*<!DOCTYPE\b/i.test(trimmed) || /^\s*<html\b/i.test(trimmed)) {
    return { document: trimmed, unwrapBody: false }
  }
  return {
    document: `<!DOCTYPE html><html><head></head><body>${trimmed}</body></html>`,
    unwrapBody: true
  }
}

function unwrapBodyIfNeeded(html: string, unwrapBody: boolean): string {
  if (!unwrapBody) return html
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  return match?.[1]?.trim() ?? html
}

/**
 * Prepare campaign HTML for transactional send.
 * Inlines `<style>` rules onto elements (Gmail strips head CSS — backgrounds, colors, etc.).
 * Keeps @media blocks in `<style>` for responsive rows; forces `desktop_hide` inline as fallback.
 */
export function prepareEmailHtmlForDelivery(html: string): string {
  if (!html.trim()) return html

  const { document, unwrapBody } = wrapHtmlDocument(html)
  let prepared = document

  try {
    prepared = juice(document, JUICE_OPTIONS)
  } catch (err) {
    console.warn('[prepareEmailHtmlForDelivery] CSS inlining failed, using raw HTML', err)
  }

  prepared = ensureDesktopHideInline(prepared)
  return unwrapBodyIfNeeded(prepared, unwrapBody)
}
