const BODY_WRAP_RE = /^<body[^>]*>([\s\S]*)<\/body>$/i
const HTML_DOC_RE = /<html[^>]*>([\s\S]*)<\/html>/i
const HEAD_BLOCK_RE = /<head[^>]*>([\s\S]*?)<\/head>/i
const BODY_BLOCK_RE = /<body[^>]*>([\s\S]*?)<\/body>/i
const STYLE_BLOCK_RE = /<style[^>]*>([\s\S]*?)<\/style>/gi
const TITLE_TAG_RE = /<title\b[^>]*>[\s\S]*?<\/title>\s*/gi
const META_TAG_RE = /<meta\b[^>]*\/?>\s*/gi
const LINK_TAG_RE = /<link\b[^>]*\/?>\s*/gi

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

/** Fragment for previews: `<style>` + body HTML (no document wrapper). */
export function serializeEmailEditorFragment(
  componentHtml: string,
  css?: string | null
): string {
  let bodyInner = componentHtml.trim()
  const bodyWrap = bodyInner.match(BODY_WRAP_RE)
  if (bodyWrap?.[1]) bodyInner = bodyWrap[1].trim()

  const cssText = css ?? ''
  if (!cssText.trim()) return bodyInner
  return `<style>${cssText}</style>${bodyInner}`
}

/** Serialize GrapesJS editor output into a full HTML document (no reformatting). */
export function serializeEmailEditorHtml(
  componentHtml: string,
  css?: string | null
): string {
  let bodyInner = componentHtml.trim()
  const bodyWrap = bodyInner.match(BODY_WRAP_RE)
  if (bodyWrap?.[1]) bodyInner = bodyWrap[1].trim()

  const { body, headTags } = hoistHeadTagsFromBody(bodyInner)
  const hasTitle = headTags.some((tag) => /^<title\b/i.test(tag))
  const cssText = css ?? ''
  const headBlock = [
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    ...(hasTitle ? [] : ['<title>Email Template</title>']),
    ...headTags,
    ...(cssText.trim() ? [`<style>${cssText}</style>`] : [])
  ].join('')

  return `<!DOCTYPE html><html lang="en"><head>${headBlock}</head><body>${body.trim()}</body></html>`
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
