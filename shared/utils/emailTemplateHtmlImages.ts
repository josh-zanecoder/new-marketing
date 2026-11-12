/**
 * Discover / replace `<img>` tags in email-template HTML without requiring users to edit markup.
 */

export type EmailTemplateHtmlImage = {
  /** 0-based order of appearance in the HTML. */
  index: number
  src: string
  tagStart: number
  tagEnd: number
}

const IMG_TAG_RE = /<img\b[^>]*\/?>/gi
const SRC_ATTR_RE = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i

function readSrcFromTag(tag: string): string {
  const m = tag.match(SRC_ATTR_RE)
  if (!m) return ''
  return m[1] ?? m[2] ?? m[3] ?? ''
}

/** List every `<img>` in document order (includes data-URLs and remote srcs). */
export function listEmailTemplateHtmlImages(html: string): EmailTemplateHtmlImage[] {
  const out: EmailTemplateHtmlImage[] = []
  if (!html) return out
  const re = new RegExp(IMG_TAG_RE.source, 'gi')
  let m: RegExpExecArray | null
  let index = 0
  while ((m = re.exec(html)) !== null) {
    const tag = m[0]
    out.push({
      index,
      src: readSrcFromTag(tag),
      tagStart: m.index,
      tagEnd: m.index + tag.length
    })
    index += 1
  }
  return out
}

/**
 * Replace only the `src` of the Nth `<img>` (0-based). Other attributes stay intact.
 * Returns the original string unchanged if the index is out of range.
 */
export function replaceEmailTemplateHtmlImageSrc(
  html: string,
  imageIndex: number,
  nextSrc: string
): string {
  const images = listEmailTemplateHtmlImages(html)
  const target = images[imageIndex]
  if (!target) return html

  const tag = html.slice(target.tagStart, target.tagEnd)
  const safeSrc = String(nextSrc ?? '').replace(/"/g, '&quot;')
  let nextTag: string
  if (SRC_ATTR_RE.test(tag)) {
    nextTag = tag.replace(SRC_ATTR_RE, `src="${safeSrc}"`)
  } else {
    nextTag = tag.replace(/^<img\b/i, `<img src="${safeSrc}"`)
  }
  return html.slice(0, target.tagStart) + nextTag + html.slice(target.tagEnd)
}

/** `<img>` markup inserted into pasted campaign or template HTML. */
export function emailHtmlImageTag(url: string, options?: { width?: number }): string {
  const src = String(url ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  const width = options?.width && options.width > 0 ? Math.round(options.width) : 600
  return `<img src="${src}" alt="" width="${width}" style="display:block;width:${width}px;max-width:100%;height:auto;border:0;" />`
}

export type EmailTemplateImageLayout = {
  width?: number
  height?: number
  left: number
  top: number
  position?: 'absolute' | 'relative'
  marginLeft?: number
  marginRight?: number
  objectPosition?: string
}

function parseStyleDeclarations(style: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const part of style.split(';')) {
    const splitAt = part.indexOf(':')
    if (splitAt === -1) continue
    const key = part.slice(0, splitAt).trim().toLowerCase()
    const value = part.slice(splitAt + 1).trim()
    if (key) map.set(key, value)
  }
  return map
}

function serializeStyleDeclarations(style: Map<string, string>): string {
  return [...style.entries()].map(([key, value]) => `${key}: ${value}`).join('; ')
}

function upsertQuotedAttr(tag: string, name: string, value: string): string {
  const safe = value.replace(/"/g, '&quot;')
  const attr = new RegExp(`\\b${name}\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+)`, 'i')
  if (attr.test(tag)) return tag.replace(attr, `${name}="${safe}"`)
  return tag.replace(/\/?>$/, (end) => ` ${name}="${safe}"${end}`)
}

const EMAIL_UNSAFE_IMAGE_STYLE = new Set(['position', 'left', 'top', 'right', 'bottom', 'z-index'])

function styleWithoutUnsafeImageLayout(style: Map<string, string>): Map<string, string> {
  const next = new Map<string, string>()
  for (const [key, value] of style) {
    if (EMAIL_UNSAFE_IMAGE_STYLE.has(key)) continue
    next.set(key, value.replace(/\s*!important\s*/gi, '').trim())
  }
  return next
}

function rewriteImageTag(tag: string, style: Map<string, string>): string {
  const serialized = serializeStyleDeclarations(style)
  if (!serialized) return tag.replace(/\s*\bstyle\s*=\s*(?:"[^"]*"|'[^']*')/i, '')
  return upsertQuotedAttr(tag, 'style', serialized)
}

const CONTENT_BLOCK_NAME = 'td|th|p|h1|h2|h3|li|div|section|center|table'
const RAW_REGION_RE = /<style\b[\s\S]*?<\/style>|<script\b[\s\S]*?<\/script>|<!--[\s\S]*?-->/gi

export type EmailContentBlock = {
  index: number
  name: string
  tagStart: number
  tagEnd: number
}

export type EmailImagePlacement =
  | { kind: 'into-block'; index: number }
  | { kind: 'end-of-block'; index: number }
  | { kind: 'before-block'; index: number }
  | { kind: 'after-block'; index: number }
  | { kind: 'before-image'; index: number }

function rawRegions(html: string): Array<[number, number]> {
  const regions: Array<[number, number]> = []
  const re = new RegExp(RAW_REGION_RE.source, 'gi')
  let match: RegExpExecArray | null
  while ((match = re.exec(html)) !== null) regions.push([match.index, match.index + match[0].length])
  return regions
}

function insideRawRegion(regions: Array<[number, number]>, position: number): boolean {
  return regions.some(([start, end]) => position >= start && position < end)
}

/** Block tags in document order, skipping styles, scripts, and comments. */
export function listEmailContentBlocks(html: string): EmailContentBlock[] {
  const out: EmailContentBlock[] = []
  if (!html) return out
  const regions = rawRegions(html)
  const re = new RegExp(`<(${CONTENT_BLOCK_NAME})\\b[^>]*>`, 'gi')
  let match: RegExpExecArray | null
  while ((match = re.exec(html)) !== null) {
    if (insideRawRegion(regions, match.index)) continue
    const name = (match[1] ?? '').toLowerCase()
    out.push({
      index: out.length,
      name,
      tagStart: match.index,
      tagEnd: match.index + match[0].length
    })
  }
  return out
}

function matchingCloseStart(html: string, openTagEnd: number, name: string): number {
  const regions = rawRegions(html)
  const re = new RegExp(`<(/?)${name}\\b[^>]*>`, 'gi')
  re.lastIndex = openTagEnd
  let depth = 1
  let match: RegExpExecArray | null
  while ((match = re.exec(html)) !== null) {
    if (insideRawRegion(regions, match.index)) continue
    depth += match[1] ? -1 : 1
    if (depth === 0) return match.index
  }
  return -1
}

/** Preview-only markers so a drop can target the section under the pointer. */
export function emailPreviewWithBlockMarkers(html: string): string {
  const blocks = listEmailContentBlocks(html)
  let next = html
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    const block = blocks[i]
    if (!block) continue
    const tag = next.slice(block.tagStart, block.tagEnd)
    if (/\bdata-email-slot\s*=/i.test(tag)) continue
    const marked = tag.replace(/>$/, ` data-email-slot="${block.index}">`)
    next = next.slice(0, block.tagStart) + marked + next.slice(block.tagEnd)
  }
  return next
}

function placeImageTag(html: string, tag: string, placement: EmailImagePlacement): { html: string; index: number } | null {
  if (placement.kind === 'before-image') {
    const dest = listEmailTemplateHtmlImages(html)[placement.index]
    if (!dest) return null
    const next = html.slice(0, dest.tagStart) + tag + html.slice(dest.tagStart)
    const index = listEmailTemplateHtmlImages(next).findIndex((image) => image.tagStart === dest.tagStart)
    return { html: emailClientSafeImageHtml(next), index: index < 0 ? 0 : index }
  }
  const block = listEmailContentBlocks(html)[placement.index]
  if (!block) return null
  let insertAt = block.tagEnd
  if (placement.kind === 'before-block') insertAt = block.tagStart
  if (placement.kind === 'end-of-block' || placement.kind === 'after-block') {
    const closeAt = matchingCloseStart(html, block.tagEnd, block.name)
    if (closeAt >= 0) {
      const closeEnd = html.indexOf('>', closeAt)
      insertAt = placement.kind === 'after-block' && closeEnd >= 0 ? closeEnd + 1 : closeAt
    }
  }
  const next = html.slice(0, insertAt) + tag + html.slice(insertAt)
  const index = listEmailTemplateHtmlImages(next).findIndex((image) => image.tagStart === insertAt)
  return { html: emailClientSafeImageHtml(next), index: index < 0 ? 0 : index }
}

/** Move an image into the section under the pointer. Leaves it alone when that section is missing. */
export function moveEmailTemplateHtmlImageTo(
  html: string,
  imageIndex: number,
  placement: EmailImagePlacement | null
): { html: string; index: number } {
  const from = listEmailTemplateHtmlImages(html)[imageIndex]
  if (!from || !placement) return { html, index: imageIndex }
  if (placement.kind === 'before-image' && placement.index === imageIndex) return { html, index: imageIndex }
  const tag = html.slice(from.tagStart, from.tagEnd)
  const without = html.slice(0, from.tagStart) + html.slice(from.tagEnd)
  let target = placement
  if (placement.kind === 'before-image') {
    const dest = imageIndex < placement.index ? placement.index - 1 : placement.index
    target = { kind: 'before-image', index: dest }
  }
  return placeImageTag(without, tag, target) ?? { html, index: imageIndex }
}

/** Insert a hosted image into the section under the pointer. */
export function insertEmailTemplateHtmlImageAtPlacement(
  html: string,
  url: string,
  placement: EmailImagePlacement | null
): { html: string; index: number } {
  const tag = emailHtmlImageTag(url, { width: 240 })
  if (!placement) {
    const next = insertEmailTemplateHtmlImage(html, url)
    return { html: next, index: Math.max(0, listEmailTemplateHtmlImages(next).length - 1) }
  }
  return placeImageTag(html, tag, placement) ?? {
    html: insertEmailTemplateHtmlImage(html, url),
    index: Math.max(0, listEmailTemplateHtmlImages(html).length)
  }
}

/**
 * Inbox clients ignore positioned images, so those offsets get stripped
 * before preview, save, and send. Width and the image address stay.
 */
export function emailClientSafeImageHtml(html: string): string {
  const images = listEmailTemplateHtmlImages(html)
  let next = html
  for (let i = images.length - 1; i >= 0; i -= 1) {
    const target = images[i]
    if (!target) continue
    const tag = next.slice(target.tagStart, target.tagEnd)
    const styleMatch = tag.match(/\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i)
    if (!styleMatch) continue
    const style = styleWithoutUnsafeImageLayout(parseStyleDeclarations(styleMatch[1] ?? styleMatch[2] ?? ''))
    const nextTag = rewriteImageTag(tag, style)
    if (nextTag === tag) continue
    next = next.slice(0, target.tagStart) + nextTag + next.slice(target.tagEnd)
  }
  return next
}

/**
 * Corner resize keeps the photo's shape. Side resize stores a fixed height so only the width changes.
 */
export function updateEmailTemplateHtmlImageLayout(
  html: string,
  imageIndex: number,
  layout: EmailTemplateImageLayout
): string {
  const target = listEmailTemplateHtmlImages(html)[imageIndex]
  if (!target || layout.width == null) return html

  const width = Math.max(24, Math.round(layout.width))
  const height = layout.height != null ? Math.max(24, Math.round(layout.height)) : null
  const tag = html.slice(target.tagStart, target.tagEnd)
  const styleMatch = tag.match(/\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i)
  const style = styleWithoutUnsafeImageLayout(parseStyleDeclarations(styleMatch?.[1] ?? styleMatch?.[2] ?? ''))
  style.set('display', style.get('display') || 'block')
  style.set('width', `${width}px`)
  style.set('max-width', '100%')
  style.set('height', height == null ? 'auto' : `${height}px`)
  style.set('object-fit', height == null ? 'fill' : 'cover')
  if (layout.objectPosition) style.set('object-position', layout.objectPosition)
  if (layout.marginLeft != null) {
    style.set('margin-left', `${Math.round(layout.marginLeft)}px`)
    style.set('margin-right', `${Math.round(layout.marginRight ?? 0)}px`)
  }
  let nextTag = rewriteImageTag(tag, style)
  nextTag = upsertQuotedAttr(nextTag, 'width', String(width))
  nextTag = height == null
    ? nextTag.replace(/\s*\bheight\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, '')
    : upsertQuotedAttr(nextTag, 'height', String(height))
  const next = html.slice(0, target.tagStart) + nextTag + html.slice(target.tagEnd)
  return emailClientSafeImageHtml(next)
}

function needleInHtml(html: string, anchorText: string): string {
  const needle = anchorText.trim()
  if (needle.length < 8) return ''
  if (html.includes(needle)) return needle
  const encoded = needle.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  if (encoded !== needle && html.includes(encoded)) return encoded
  return ''
}

/** Place an image in normal document flow, just before a visible piece of the email. */
export function insertEmailTemplateHtmlImageBeforeText(html: string, url: string, anchorText: string): string {
  const needle = needleInHtml(html, anchorText)
  if (!needle) return html
  const tag = emailHtmlImageTag(url, { width: 240 })
  return html.replace(needle, `${tag}${needle}`)
}

/** Move an existing image to sit just before a visible piece of the email. Leaves it where it is when that text is not in the email. */
export function moveEmailTemplateHtmlImageBeforeText(
  html: string,
  imageIndex: number,
  anchorText: string
): string {
  const target = listEmailTemplateHtmlImages(html)[imageIndex]
  if (!target) return html
  const tag = html.slice(target.tagStart, target.tagEnd)
  const without = html.slice(0, target.tagStart) + html.slice(target.tagEnd)
  const needle = needleInHtml(without, anchorText)
  if (!needle) return html
  return emailClientSafeImageHtml(without.replace(needle, `${tag}${needle}`))
}

/** Insert an image before `</body>` when the email is a full document, otherwise append it. */
export function insertEmailTemplateHtmlImage(html: string, url: string): string {
  const tag = emailHtmlImageTag(url, { width: 240 })
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${tag}</body>`)
  return `${html}${tag}`
}

/** @deprecated Drop uses document flow. Kept so older callers still insert an email-safe image. */
export function insertEmailTemplateHtmlImageAt(
  html: string,
  url: string,
  _position?: { left: number; top: number }
): string {
  return insertEmailTemplateHtmlImage(html, url)
}

/** Remove the Nth `<img>`. Returns the original string when the index is missing. */
export function removeEmailTemplateHtmlImage(html: string, imageIndex: number): string {
  const target = listEmailTemplateHtmlImages(html)[imageIndex]
  if (!target) return html
  return html.slice(0, target.tagStart) + html.slice(target.tagEnd)
}

/** Accept only http(s) image links. Returns null when the value is not a usable URL. */
export function parseInsertableImageUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  return url.toString()
}

/** Full document for a 1:1 preview. Does not rewrite the email markup. */
export function emailPreviewDocument(html: string): string {
  const trimmed = html.trim()
  if (!trimmed) return '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body></body></html>'
  if (/<html[\s>]/i.test(trimmed)) return trimmed
  if (/<body[\s>]/i.test(trimmed)) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>${trimmed}</html>`
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${trimmed}</body></html>`
}

/** Save the original email, wrapping a fragment once so campaigns still get a document. */
export function emailImageBuilderExportHtml(html: string): string {
  const trimmed = emailClientSafeImageHtml(html).trim()
  if (!trimmed) return emailPreviewDocument('')
  if (/<html[\s>]/i.test(trimmed)) return trimmed
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Email Template</title></head><body>${trimmed}</body></html>`
}

/** Short label for UI chips (avoids dumping entire base64 into the label). */
export function emailTemplateHtmlImageLabel(src: string, index: number): string {
  const n = index + 1
  const s = (src || '').trim()
  if (!s) return `Image ${n} (no src)`
  if (/^data:image\//i.test(s)) {
    const kind = s.slice(11, s.indexOf(';')).toUpperCase() || 'IMG'
    return `Image ${n} · Embedded ${kind}`
  }
  try {
    const u = new URL(s)
    const file = u.pathname.split('/').filter(Boolean).pop() || u.hostname
    return `Image ${n} · ${file}`
  } catch {
    return `Image ${n}`
  }
}
