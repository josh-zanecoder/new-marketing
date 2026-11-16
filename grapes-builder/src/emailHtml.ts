/**
 * Same rules as new-marketing `shared/utils/emailEditorHtml.ts`:
 * save full HTML documents to Mongo; load body+styles into Grapes.
 */

const BODY_WRAP_RE = /^<body[^>]*>([\s\S]*)<\/body>$/i
const HTML_DOC_RE = /<html[^>]*>([\s\S]*)<\/html>/i
const HEAD_BLOCK_RE = /<head[^>]*>([\s\S]*?)<\/head>/i
const BODY_BLOCK_RE = /<body[^>]*>([\s\S]*?)<\/body>/i
const STYLE_BLOCK_RE = /<style[^>]*>([\s\S]*?)<\/style>/gi
const TITLE_TAG_RE = /<title\b[^>]*>[\s\S]*?<\/title>\s*/gi
const META_TAG_RE = /<meta\b[^>]*\/?>\s*/gi
const LINK_TAG_RE = /<link\b[^>]*\/?>\s*/gi

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

/** Prepare stored Mongo HTML for Grapes `setComponents`. */
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
  headWithoutStyle = headWithoutStyle.replace(STYLE_BLOCK_RE, (_full, css: string) => {
    styles.push(css)
    return ''
  })

  const headTags = headWithoutStyle.replace(/<!--[\s\S]*?-->/g, '').trim()
  const styleBlock = styles.length ? `<style>${styles.join('\n')}</style>` : ''

  return `${styleBlock}${headTags ? `${headTags}\n` : ''}${bodyContent}`
}
