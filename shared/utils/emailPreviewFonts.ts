/** Google Fonts / CDN stylesheet support for email preview iframes (blob URLs). */

export const FONT_PRECONNECT_TAGS = [
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
].join('')

const STYLESHEET_LINK_RE =
  /<link\b[^>]*\brel\s*=\s*["']stylesheet["'][^>]*>/gi

const FONT_STYLESHEET_LINK_RE =
  /<link\b[^>]*\bhref\s*=\s*["'][^"']*(?:fonts\.googleapis\.com|fonts\.bunny\.net|use\.typekit\.net|cloud\.typography\.com)[^"']*["'][^>]*>/gi

function normalizeLinkTag(tag: string): string {
  return tag.trim().replace(/\s+/g, ' ')
}

function linkHref(tag: string): string | null {
  const match = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)
  return match?.[1]?.trim() ?? null
}

/** Collect CDN stylesheet `<link>` tags from raw HTML (includes MSO conditional wrappers). */
export function extractExternalStylesheetLinks(html: string): string[] {
  const byHref = new Map<string, string>()

  const consider = (tag: string) => {
    const normalized = normalizeLinkTag(tag)
    const href = linkHref(normalized)
    if (!href) return
    if (!byHref.has(href)) byHref.set(href, normalized)
  }

  for (const match of html.matchAll(STYLESHEET_LINK_RE)) {
    consider(match[0])
  }
  for (const match of html.matchAll(FONT_STYLESHEET_LINK_RE)) {
    consider(match[0])
  }

  return Array.from(byHref.values())
}

function headContainsStylesheet(html: string, href: string): boolean {
  return html.toLowerCase().includes(href.toLowerCase())
}

function injectAfterHeadOpen(html: string, injection: string): string {
  if (!injection.trim()) return html
  if (/<head\b/i.test(html)) {
    return html.replace(/<head(\b[^>]*)>/i, `<head$1>${injection}`)
  }
  if (html.includes('</head>')) {
    return html.replace('</head>', `${injection}</head>`)
  }
  return `<!DOCTYPE html><html lang="en"><head>${injection}</head><body>${html}</body></html>`
}

/**
 * Ensure Google Fonts / CDN stylesheets load inside preview iframes.
 * Adds preconnect hints and re-injects any font links missing from `<head>`.
 */
export function ensurePreviewFontAssets(html: string): string {
  const fontLinks = extractExternalStylesheetLinks(html)
  if (fontLinks.length === 0) return html

  const missingLinks = fontLinks.filter((tag) => {
    const href = linkHref(tag)
    return href ? !headContainsStylesheet(html, href) : false
  })

  const injection = `${FONT_PRECONNECT_TAGS}${missingLinks.join('')}`
  if (!injection.trim()) return html

  return injectAfterHeadOpen(html, injection)
}
