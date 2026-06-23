const BODY_WRAP_RE = /^<body[^>]*>([\s\S]*)<\/body>$/i
const HTML_DOC_RE = /<html[^>]*>([\s\S]*)<\/html>/i
const HEAD_BLOCK_RE = /<head[^>]*>([\s\S]*?)<\/head>/i
const BODY_BLOCK_RE = /<body[^>]*>([\s\S]*?)<\/body>/i
const STYLE_BLOCK_RE = /<style[^>]*>([\s\S]*?)<\/style>/gi
const TITLE_TAG_RE = /<title\b[^>]*>[\s\S]*?<\/title>\s*/gi
const META_TAG_RE = /<meta\b[^>]*\/?>\s*/gi
const LINK_TAG_RE = /<link\b[^>]*\/?>\s*/gi

/** True when HTML is already a full document (GrapesJS export or uploaded file). */
export function isEmailHtmlDocument(html: string): boolean {
  const trimmed = html.trim()
  return /<!DOCTYPE\s+html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)
}

function extractStyleBlocks(html: string): { html: string; styles: string[] } {
  const styles: string[] = []
  let rest = html
  let searchFrom = 0
  while (searchFrom < rest.length) {
    const open = rest.indexOf('<style', searchFrom)
    if (open === -1) break
    const openEnd = rest.indexOf('>', open)
    if (openEnd === -1) break
    const close = rest.indexOf('</style>', openEnd + 1)
    if (close === -1) break
    styles.push(rest.slice(openEnd + 1, close))
    rest = rest.slice(0, open) + rest.slice(close + 8)
    searchFrom = open
  }
  return { html: rest, styles }
}

function hoistHeadTagsFromBody(bodyInner: string): { body: string; headTags: string[] } {
  const headTags: string[] = []
  let body = bodyInner

  body = body.replace(TITLE_TAG_RE, (tag) => {
    headTags.push(tag.trim())
    return ''
  })
  body = body.replace(META_TAG_RE, (tag) => {
    headTags.push(tag.trim())
    return ''
  })
  body = body.replace(LINK_TAG_RE, (tag) => {
    headTags.push(tag.trim())
    return ''
  })

  return { body, headTags }
}

function mergeCssBlocks(...groups: Array<string | null | undefined | string[]>): string {
  const parts: string[] = []
  for (const group of groups) {
    if (!group) continue
    if (Array.isArray(group)) {
      for (const block of group) {
        const t = block.trim()
        if (t) parts.push(t)
      }
      continue
    }
    const t = group.trim()
    if (t) parts.push(t)
  }
  return parts.join('\n')
}

/** Fragment for previews: `<style>` + body HTML (no document wrapper). */
export function serializeEmailEditorFragment(
  componentHtml: string,
  css?: string | null
): string {
  let bodyInner = componentHtml.trim()
  const bodyWrap = bodyInner.match(BODY_WRAP_RE)
  if (bodyWrap?.[1]) bodyInner = bodyWrap[1].trim()

  const extracted = extractStyleBlocks(bodyInner)
  const cssText = mergeCssBlocks(extracted.styles, css)
  if (!cssText) return extracted.html.trim()
  return `<style>${cssText}</style>${extracted.html.trim()}`
}

/** Serialize GrapesJS editor output into a full HTML document (no reformatting). */
export function serializeEmailEditorHtml(
  componentHtml: string,
  css?: string | null
): string {
  const trimmed = componentHtml.trim()
  if (!trimmed) {
    const cssOnly = css?.trim()
    if (!cssOnly) return ''
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Email Template</title><style>${cssOnly}</style></head><body></body></html>`
  }

  if (isEmailHtmlDocument(trimmed)) {
    const extraCss = css?.trim()
    if (!extraCss) return trimmed
    if (/<\/head>/i.test(trimmed)) {
      return trimmed.replace(/<\/head>/i, `<style>${extraCss}</style></head>`)
    }
    return trimmed
  }

  let bodyInner = trimmed
  const bodyWrap = bodyInner.match(BODY_WRAP_RE)
  if (bodyWrap?.[1]) bodyInner = bodyWrap[1].trim()

  const extracted = extractStyleBlocks(bodyInner)
  const { body, headTags } = hoistHeadTagsFromBody(extracted.html)
  const hasTitle = headTags.some((tag) => /^<title\b/i.test(tag))
  const cssText = mergeCssBlocks(extracted.styles, css)
  const headBlock = [
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    ...(hasTitle ? [] : ['<title>Email Template</title>']),
    ...headTags,
    ...(cssText ? [`<style>${cssText}</style>`] : [])
  ].join('')

  return `<!DOCTYPE html><html lang="en"><head>${headBlock}</head><body>${body.trim()}</body></html>`
}

/**
 * Merge stored template fields into a full HTML document.
 * Never prepends legacy `css` when `htmlTemplate` is already a full document.
 */
export function resolveEmailTemplateHtml(template: {
  htmlTemplate?: string | null
  html?: string | null
  css?: string | null
}): string {
  const raw = (template.htmlTemplate ?? template.html ?? '').trim()
  if (!raw) return ''
  if (isEmailHtmlDocument(raw)) return raw
  const legacyCss = (template.css ?? '').trim()
  return serializeEmailEditorHtml(raw, legacyCss || null)
}

/** Normalize editor output before persisting to MongoDB (always a full HTML document). */
export function normalizeEmailTemplateForStorage(
  html: string,
  _source: 'editor' | 'upload' = 'editor'
): string {
  const trimmed = html.trim()
  if (!trimmed) return trimmed
  if (isEmailHtmlDocument(trimmed)) return trimmed
  return serializeEmailEditorHtml(trimmed, null)
}

export function ensureFullEmailHtmlDocument(html: string): string {
  return normalizeEmailTemplateForStorage(html)
}

/**
 * Inbox-safe send prep: keep the stored full HTML intact and duplicate `<head>` CSS at
 * the top of `<body>` for clients that drop `<head>` (Gmail). Never rebuilds the document.
 */
export function prepareEmailHtmlForDelivery(html: string): string {
  const full = ensureFullEmailHtmlDocument(html).trim()
  if (!full) return full

  const bodyOpen = full.match(/<body\b[^>]*>/i)
  if (!bodyOpen || bodyOpen.index == null) return full

  const bodyStart = bodyOpen.index + bodyOpen[0].length
  const afterBodyOpen = full.slice(bodyStart, bodyStart + 256)
  if (/^\s*<style\b/i.test(afterBodyOpen)) {
    return full
  }

  const headMatch = full.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)
  if (!headMatch?.[1]) return full

  const { styles } = extractStyleBlocks(headMatch[1])
  const css = mergeCssBlocks(styles)
  if (!css) return full

  const injection = `<style>${css}</style>`
  return `${full.slice(0, bodyStart)}${injection}${full.slice(bodyStart)}`
}

/** Prepare stored HTML for GrapesJS `setComponents`. */
export function deserializeEmailEditorHtml(stored: string): string {
  const trimmed = stored.trim()
  if (!trimmed) return trimmed

  const htmlMatch = trimmed.match(HTML_DOC_RE)
  if (!htmlMatch?.[1]) return trimmed

  const docInner = htmlMatch[1]
  const headContent = docInner.match(HEAD_BLOCK_RE)?.[1] ?? ''
  const bodyContent = docInner.match(BODY_BLOCK_RE)?.[1]?.trim() ?? docInner.trim()

  const styles: string[] = []
  let headWithoutStyle = headContent
  headWithoutStyle = headWithoutStyle.replace(STYLE_BLOCK_RE, (_, css: string) => {
    styles.push(css)
    return ''
  })

  const headTags = headWithoutStyle.replace(/<!--[\s\S]*?-->/g, '').trim()
  const styleBlock = styles.length ? `<style>${styles.join('\n')}</style>` : ''

  return `${styleBlock}${headTags ? `${headTags}\n` : ''}${bodyContent}`
}
